import glob
from random import shuffle

class PreprocessData:
	def __init__(self):
		self.vocabulary = {}
		self.pos_tags = {}

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

		trainFile = open(base_path + '/train.txt', 'w')
		valFile = open(base_path + '/val.txt', 'w')
		testFile = open(base_path + '/test.txt', 'w')

		train_examples = all_examples[0 : num_examples * 6 / 8]
		val_examples = all_examples[num_examples * 6 / 8 : num_examples * 7 / 8]
		test_examples = all_examples[num_examples * 7 / 8 + 1 :]

		trainFile.write("".join(train_examples))
		valFile.write("".join(val_examples))
		testFile.write("".join(test_examples))
		
		train_file = base_path + '/train.txt'
		val_file = base_path + '/val.txt'
		test_file = base_path + '/test.txt'

		return train_file, val_file, test_file

	## unknown words represented by len(vocab)
	def get_unk_id(self, dic):
		return len(dic)

	def get_pad_id(self, dic):
		return len(self.vocabulary) + 1

	## get id of given token(pos) from dictionary dic.
	## if not in dic, extend the dic if in train mode
	## else use representation for unknown token
	def get_id(self, pos, dic, mode):
		if pos not in dic:
			if mode == 'train':
				dic[pos] = len(dic)
			else:
				return self.get_unk_id(dic)

		return dic[pos]

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
					feature = self.get_id(token, self.vocabulary, mode)
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
				X_row += [self.get_pad_id(self.vocabulary)] * (max_size - len(X_row))

			X.append(tuple(X_row))

		return X, Y
