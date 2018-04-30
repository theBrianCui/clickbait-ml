import glob
import os
import numpy
from gensim.models import KeyedVectors
from random import shuffle

class PreprocessData:
	def __init__(self):
		self.vocabulary = {}
		self.pos_tags = {}
		self.filename = '/Users/Akshay/Downloads/GoogleNews-vectors-negative300.bin'
		self.model = KeyedVectors.load_word2vec_format(self.filename, binary=True)

	## Get standard split for training, validation, and test
	def get_standard_split(self, clickbait_raw, normal_raw, base_path):
		all_examples = []
		with open(clickbait_raw, "r") as f:
			for line in f:
				all_examples.append(str(1) + " " + line)

		with open(normal_raw, "r") as f:
			for line in f:
				all_examples.append(str(0) + " " + line)

		# shuffle all the examples in place
		shuffle(all_examples)
		num_examples = len(all_examples)

		train_file = os.getcwd() + '/train.txt'
		val_file = os.getcwd() + '/val.txt'
		test_file = os.getcwd() + '/test.txt'

		trainFile = open(train_file, 'w+')
		valFile = open(val_file, 'w+')
		testFile = open(test_file, 'w+')

		train_examples = all_examples[0 : num_examples * 6 / 8]
		val_examples = all_examples[num_examples * 6 / 8 : num_examples * 7 / 8]
		test_examples = all_examples[num_examples * 7 / 8 + 1 :]

		trainFile.write("".join(train_examples))
		valFile.write("".join(val_examples))
		testFile.write("".join(test_examples))

		return train_file, val_file, test_file

	## unknown words represented by len(vocab)
	def get_unk_id(self):
		return numpy.array([0.0] * 300)

	def get_pad_id(self):
		return numpy.array([0.0] * 300)

	## get id of given token(pos) from dictionary dic.
	## if not in dic, extend the dic if in train mode
	## else use representation for unknown token
	def get_id(self, pos, mode):
		try:
			return self.model.get_vector(pos)
		except:
			return self.get_unk_id()

	## Process single file to get raw data matrix
	## The raw data matrix is shaped like ( (0|1, (tokens... )) ...)
	def process_single_file(self, inFileName, mode):
		matrix = []
		num_words = 0

		with open(inFileName) as f:
			lines = f.readlines()

			for line in lines:
				line = line.strip()
				is_clickbait = 0

				if line == '':
					continue

				tokens = line.split()
				row = []
				if tokens[0] == "1":
					is_clickbait = 1

				for token in tokens[1:]:
					feature = self.get_id(token, mode)
					row.append(feature)
				matrix.append((is_clickbait, row))

		return matrix

	def split_data(self, data, fraction):
		split_index = int(fraction*len(data))
		left_split = data[:split_index]
		right_split = data[split_index:]

		if not(left_split):
			raise Exception('Fraction too small')

		if not(right_split):
			raise Exception('Fraction too big')

		return left_split, right_split

	## Truncate sentences greater than max_size
	## and pad the remaining if less than max_size
	## The raw data matrix is shaped like ( (0|1, (tokens... )) ...)
	def get_processed_data(self, mat, max_size):
		X = [] # an array of tuples, each tuple is a tokenized sentence (in id form, including padding and unknown)
		Y = [] # an array of numbers, 1 for clickbait, 0 otherwise

		for row in mat:
			Y.append(row[0])
			X_row = list(row[1])

			# truncate X_row if it's too long
			if len(X_row) > max_size:
				X_row = X_row[0:max_size]
			else: # pad X_row if it's too short
				X_row += [self.get_pad_id()] * (max_size - len(X_row))

			X.append(tuple(X_row))

		return X, Y

if __name__ == '__main__':
	exit(1)