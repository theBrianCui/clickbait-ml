import glob
import sys
import tensorflow as tf
import numpy as np
import time
import math
import os
import shutil
import itertools
from datetime import datetime
from random import shuffle
from preprocess import PreprocessData

MAX_LENGTH = 20
BATCH_SIZE = 128
VALIDATION_FREQUENCY = 10
CHECKPOINT_FREQUENCY = 50
NO_OF_EPOCHS = 6

## Model class is adatepd from model.py found here
## https://github.com/monikkinom/ner-lstm/
class Model:
	def __init__(self, sequence_len, hidden_state_size=300):
		self._sequence_len = sequence_len
		self._hidden_state_size = hidden_state_size
		self._optimizer = tf.train.AdamOptimizer(0.0005)

	# Adapted from https://github.com/monikkinom/ner-lstm/blob/master/model.py __init__ function
	def create_placeholders(self):
		self._input_words = tf.placeholder(tf.float64, [BATCH_SIZE, self._sequence_len, self._hidden_state_size])
		self._output_clickbait = tf.placeholder(tf.int32, [BATCH_SIZE, 1])


	#def set_input_output(self, input_, output):
	#	self._input_words = input_
	#	self._output_tags = output

	## Returns the mask that is 1 for the actual words
	## and 0 for the padded part
	# Adapted from https://github.com/monikkinom/ner-lstm/blob/master/model.py __init__ function
	def get_mask(self, t):
		mask = tf.cast(tf.not_equal(t, -1), tf.int32)
		lengths = tf.reduce_sum(mask, reduction_indices=1)
		return mask, lengths

	## Embed the large one hot input vector into a smaller space
	## to make the lstm learning tractable
	def get_embedding(self, input_): ## TODO Replace with word2vec pretrained vectors
		embedding = tf.get_variable("embedding",
									[self._input_dim, self._hidden_state_size], dtype=tf.float32)
		return tf.nn.embedding_lookup(embedding,tf.cast(input_, tf.int32))

	# Adapted from https://github.com/monikkinom/ner-lstm/blob/master/model.py __init__ function
	def create_graph(self):
		self.create_placeholders()

		## Since we are padding the input, we need to give
		## the actual length of every instance in the batch
		## so that the backward lstm works properly
		'''
		self._mask, self._lengths = self.get_mask(self._output_tags)
		self._total_length = tf.reduce_sum(self._lengths)
		'''

		## Embed the very large input vector into a smaller dimension
		## This is for computational tractability
		#with tf.variable_scope("lstm_input"):
			#lstm_input = self.get_embedding(self._input_words) # expected to return [BATCH SIZE, MAX LEN, 300]

			# """
			# if self._mode == Mode.INPUT:
			# 	prefix = tf.one_hot(self._prefix_features, self._prefix_dim)
			# 	suffix = tf.one_hot(self._suffix_features, self._suffix_dim)
            #
			# 	self._hidden_state_size += self._prefix_dim + self._suffix_dim
            #
			# 	lstm_input = tf.concat([lstm_input, prefix, suffix], axis=2)"""

		## Create forward and backward cell
		forward_cell = tf.contrib.rnn.LSTMCell(self._hidden_state_size, state_is_tuple=True)
		backward_cell = tf.contrib.rnn.LSTMCell(self._hidden_state_size, state_is_tuple=True)

		## Apply bidrectional dyamic rnn to get a tuple of forward
		## and backward outputs. Using dynamic rnn instead of just
		## an rnn avoids the task of breaking the input into
		## into a list of tensors (one per time step)
		with tf.variable_scope("lstm"):
			outputs, _ = tf.nn.bidirectional_dynamic_rnn(forward_cell, backward_cell,
														 self._input_words, dtype=tf.float32) #sequence_length=self._lengths)

		with tf.variable_scope("lstm_output"):
			## concat forward and backward states
			outputs = tf.concat(outputs, 2)

			## Apply linear transformation to get logits(unnormalized scores)
			logits = self.compute_logits(outputs)

			## Get the normalized probabilities
			## Note that this a rank 3 tensor
			## It contains the probabilities of
			## different POS tags for each batch
			## example at each time step
			self._probabilities = tf.nn.softmax(logits)

		self._loss = self.cost(self._output_clickbait, self._probabilities)
		self._average_loss = self._loss/tf.cast(BATCH_SIZE, tf.float32)

		self._accuracy = self.compute_accuracy(self._output_clickbait, self._probabilities) #, self._mask)
		self._average_accuracy = self._accuracy/tf.cast(BATCH_SIZE, tf.float32)

	# Taken from https://github.com/monikkinom/ner-lstm/blob/master/model.py weight_and_bias function
	## Creates a fully connected layer with the given dimensions and parameters
	def initialize_fc_layer(self, row_dim, col_dim, stddev=0.01, bias=0.1):
		weight = tf.truncated_normal([row_dim, col_dim], stddev=stddev)
		bias = tf.constant(bias, shape=[col_dim])
		return tf.Variable(weight, name='weight'), tf.Variable(bias, name='bias')

	# Taken from https://github.com/monikkinom/ner-lstm/blob/master/model.py __init__ function
	def compute_logits(self, outputs):
		softmax_input_size = int(outputs.get_shape()[2])
		outputs = tf.reshape(outputs, [-1, softmax_input_size])

		weights, bias = self.initialize_fc_layer(softmax_input_size, 2)

		logits = tf.matmul(outputs, weights) + bias
		logits = tf.reshape(logits, [-1, self._sequence_len, 2])
		return logits

	def add_loss_summary(self):
		tf.summary.scalar('Loss', self._average_loss)

	def add_accuracy_summary(self):
		tf.summary.scalar('Accuracy', self._average_accuracy)

	# Taken from https://github.com/monikkinom/ner-lstm/blob/master/model.py __init__ function
	def get_train_op(self, loss, global_step):
		training_vars = tf.trainable_variables()
		grads, _ = tf.clip_by_global_norm(tf.gradients(loss, training_vars), 10)
		apply_gradient_op = self._optimizer.apply_gradients(zip(grads, training_vars),
															global_step)
		return apply_gradient_op

	# Adapted from https://github.com/monikkinom/ner-lstm/blob/master/model.py cost function
	def compute_accuracy(self, clickbait_or_not, probabilities, mask = None):
		predicted_classes = tf.cast(tf.argmax(probabilities, dimension=2), tf.int32)
		correct_predictions = tf.cast(tf.equal(predicted_classes, clickbait_or_not), tf.int32)
		if (mask != None):
			correct_predictions = tf.multiply(correct_predictions, mask)
		return tf.cast(tf.reduce_sum(correct_predictions), tf.float32)

	# Adapted from https://github.com/monikkinom/ner-lstm/blob/master/model.py cost function
	def cost(self, clickbait_or_not, probabilities):
		pos_classes = tf.cast(clickbait_or_not, tf.int32)
		pos_one_hot = tf.one_hot(pos_classes, 2)
		pos_one_hot = tf.cast(pos_one_hot, tf.float32)
		## masking not needed since pos class vector will be zero for
		## padded time steps
		cross_entropy = pos_one_hot*tf.log(probabilities)
		return -tf.reduce_sum(cross_entropy)

	@property
	def input_words(self):
		return self._input_words

	@property
	def output_tags(self):
		return self._output_tags

	@property
	def loss(self):
		return self._loss

	@property
	def accuracy(self):
		return self._accuracy

	@property
	def total_length(self):
		return self._total_length

# Adapted from http://r2rt.com/recurrent-neural-networks-in-tensorflow-i.html
def generate_batch(X, Y):
	for i in xrange(0, len(X), BATCH_SIZE):
		yield X[i:i + BATCH_SIZE], Y[i:i + BATCH_SIZE]

def shuffle_data(X, Y):
	ran = range(len(X))
	shuffle(ran)
	return [X[num] for num in ran], [Y[num] for num in ran]

# Adapted from http://r2rt.com/recurrent-neural-networks-in-tensorflow-i.html
def generate_epochs(X, Y, no_of_epochs):
	lx = len(X)
	lx = (lx//BATCH_SIZE)*BATCH_SIZE
	X = X[:lx]
	Y = Y[:lx]
	for i in range(no_of_epochs):
		X, Y = shuffle_data(X, Y)
		yield generate_batch(X, Y)

## Compute overall loss and accuracy on dev/test data
def compute_summary_metrics(sess, m, sentence_words_val, sentence_tags_val, pre, suf):
	loss, accuracy, total_len, accuracy_oov, total_len_oov = 0.0, 0.0, 0, 0.0, 0
	for i, epoch in enumerate(generate_epochs(sentence_words_val, sentence_tags_val, pre, suf, 1)):
		for step, (X, Y, P, S) in enumerate(epoch):
			batch_loss, batch_accuracy, batch_len, batch_accuracy_oov, batch_len_oov = \
				sess.run([m.loss, m.accuracy, m.total_length, m.accuracy_oov, m.total_length_oov],
						 feed_dict={m.input_words: X, m.output_tags: Y, m.prefix_features: P, m.suffix_features: S})
			loss += batch_loss
			accuracy += batch_accuracy
			total_len += batch_len
			accuracy_oov += batch_accuracy_oov
			total_len_oov += batch_len_oov
	loss = loss/total_len if total_len != 0 else 0
	accuracy = accuracy/total_len if total_len != 0 else 1
	accuracy_oov = accuracy_oov / total_len_oov if total_len_oov != 0 else 1
	return loss, accuracy, accuracy_oov

## train and test adapted from https://github.com/tensorflow/tensorflow/blob/master/tensorflow/
## models/image/cifar10/cifar10_train.py and cifar10_eval.py
def train(words_train, clickbait_train, words_validation,
		  clickbait_validation, train_dir):
	m = Model(MAX_LENGTH)

	with tf.Graph().as_default():
		global_step = tf.Variable(0, trainable=False)

		## Add input/output placeholders
		## m.create_placeholders() duplicate funcall?
		## create the model graph
		m.create_graph()
		## create training op
		train_op = m.get_train_op(m.loss, global_step)

		## create saver object which helps in checkpointing
		## the model
		saver = tf.train.Saver(tf.global_variables()+tf.local_variables())

		## add scalar summaries for loss, accuracy
		m.add_accuracy_summary()
		m.add_loss_summary()
		summary_op = tf.summary.merge_all()

		## Initialize all the variables
		init = tf.global_variables_initializer()
		sess = tf.Session(config=tf.ConfigProto())
		sess.run(init)

		summary_writer = tf.summary.FileWriter(train_dir, sess.graph)
		j = 0
		start_time = time.time()
		for i, epoch in enumerate(generate_epochs(words_train, clickbait_train, NO_OF_EPOCHS)):
	
			for step, (X, Y) in enumerate(epoch):

				_, summary_value = sess.run([train_op, summary_op], feed_dict=
				{m.input_words:X, m.output_tags:Y})
				duration = time.time() - start_time
				j += 1
				if j % VALIDATION_FREQUENCY == 0:
					val_loss, val_accuracy, val_accuracy_oov = compute_summary_metrics(sess, m, sentence_words_val, sentence_tags_val, pre_val, suf_val)
					summary = tf.Summary()
					summary.ParseFromString(summary_value)
					summary.value.add(tag='Validation Loss', simple_value=val_loss)
					summary.value.add(tag='Validation Accuracy', simple_value=val_accuracy)
					summary.value.add(tag='Validation OOV Accuracy', simple_value=val_accuracy_oov)
					summary_writer.add_summary(summary, j)
					log_string = '{} batches ====> Validation Accuracy {:.3f}, Validation OOV Accuracy {:.3f}, Validation Loss {:.3f}'
					print duration, log_string.format(j, val_accuracy, val_accuracy_oov, val_loss)
				else:
					summary_writer.add_summary(summary_value, j)

				if j % CHECKPOINT_FREQUENCY == 0:
					checkpoint_path = os.path.join(train_dir, 'model.ckpt')
					saver.save(sess, checkpoint_path, global_step=j)

## Check performance on held out test data
## Loads most recent model from train_dir
## and applies it on test data
def test(words_test, clickbait_test, train_dir):
	m = Model(MAX_LENGTH)
	with tf.Graph().as_default():
		global_step = tf.Variable(0, trainable=False)
		m.create_placeholders()
		m.create_graph()
		saver = tf.train.Saver(tf.global_variables())
		with tf.Session() as sess:
			ckpt = tf.train.get_checkpoint_state(train_dir)
			if ckpt and ckpt.model_checkpoint_path:
				saver.restore(sess, ckpt.model_checkpoint_path)

				global_step = ckpt.model_checkpoint_path.split('/')[-1].split('-')[-1]
			test_loss, test_accuracy, test_accuracy_oov = compute_summary_metrics(sess, m, sentence_words_test,
															   sentence_tags_test, pre_test, suf_test)
			print 'OOV Test Accuracy: {:.3f}'.format(test_accuracy_oov)
			print 'Test Accuracy: {:.3f}'.format(test_accuracy)
			print 'Test Loss: {:.3f}'.format(test_loss)


if __name__ == '__main__':
	# specify location of clickbait and normal files
	clickbait_raw_path = sys.argv[1]
	normal_raw_path = sys.argv[2]

	# specify directory where model is saved or loaded
	train_dir = sys.argv[3]
	# specify train or test
	experiment_type = sys.argv[4]

	# initialize a new PreprocessData instance
	p = PreprocessData()
	# split them into training, validation, and test files
	# these will be saved in train_dir/train.txt, train_dir/val.txt, train_dir/test.txt
	train_file, val_file, test_file = p.get_standard_split(
		clickbait_raw_path, normal_raw_path, train_dir)

	train_mat = p.process_single_file(train_file, 'train')
	val_mat = p.process_single_file(val_file, 'validation')
	test_mat = p.process_single_file(test_file, 'test')

	X_train, Y_train = p.get_processed_data(train_mat, MAX_LENGTH)
	X_val, Y_val = p.get_processed_data(val_mat, MAX_LENGTH)
	X_test, Y_test = p.get_processed_data(test_mat, MAX_LENGTH)

	# TODO model not ready. exit.

	if experiment_type == 'train':
		if os.path.exists(train_dir):
			shutil.rmtree(train_dir)
		os.mkdir(train_dir)
		train(X_train, Y_train, X_val, Y_val, train_dir)
	else:
		test(X_test, Y_test, train_dir)