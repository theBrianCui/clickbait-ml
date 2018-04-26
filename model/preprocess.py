import glob
from random import shuffle

MAX_LENGTH = 100


class PreprocessData:
	'''
	prefixes = ['a', 'ab', 'ac', 'ad', 'an', 'ante', 'anti', 'as', 'auto', 'ben', 'bi', 'circum', 'co', 'com', 'con',
				'contra', 'counter', 'de', 'di', 'dis', 'ecto', 'eu', 'ex', 'exo', 'extra', 'extro', 'fore', 'hemi',
				'hyper', 'hypo', 'il', 'im' 'in', 'inter', 'intra', 'ir', 'macro', 'mal', 'micro', 'mis', 'mono',
				'multi', 'non', 'o', 'ob', 'oc', 'omni', 'op', 'peri', 'poly', 'post', 'pre', 'pro', 'quad', 're',
				'semi', 'sub', 'super', 'supra', 'sym', 'syn', 'trans', 'tri', 'ultra', 'un', 'uni']
	suffixes = ['able', 'acy', 'al', 'al', 'ance', 'ate', 'dom', 'en', 'ence', 'er', 'esque', 'ful', 'fy', 'ible', 'ic',
				'ical', 'ify', 'ious', 'ise', 'ish', 'ism', 'ist', 'ity', 'ive', 'ize', 'less', 'ment', 'ness', 'or',
				'ous', 'ship', 'sion', 'tion', 'ty', 'y']
	'''

	def __init__(self):
		self.vocabulary = {}
		self.pos_tags = {}

		'''
		self.prefix_orthographic_features = {}
		self.suffix_orthographic_features = {}

		self.prefix_orthographic_features['nothing'] = 0
		self.suffix_orthographic_features['nothing'] = 0

		self.prefix_orthographic_features['capitalized'] = 1
		self.prefix_orthographic_features['num'] = 2

		self.suffix_orthographic_features['hyphenated'] = 1
		'''

	## Get standard split for WSJ
	def get_standard_split(self, files, base_path):
		all_examples = []

		for file_ in files:
			is_clickbait = 0

			if("clickbait" in file_):
				is_clickbait = 1

			with open(file_) as f:
				lines = f.readlines()

				for line in lines:
					example = []
					example.append(is_clickbait + " " + line)
					all_examples.append(example)
			
		random.shuffle(all_examples)
		num_examples = len(all_examples)

		trainFile = open(base_path + '/train.txt', 'w')
		valFile = open(base_path + '/val.txt', 'w')
		testFile = open(base_path + '/test.txt', 'w')

		train_examples = all_examples[0 : num_examples * 3 / 4]
		val_examples = all_examples[num_examples * 3 / 4 : num_examples * 7 / 8]
		test_examples = all_examples[num_examples * 7 / 8 + 1 :]
		
		trainFile.write("\n".join(train_examples))
		valFile.write("\n".join(val_examples))
		testFile.write("\n".join(test_examples))
		
		train_files = [base_path + '/train.txt']
		val_files = [base_path + '/val.txt']
		test_files = [base_path + '/test.txt']

		return train_files, val_files, test_files

	'''
	@staticmethod
	def isFeasibleStartingCharacter(c):
		unfeasibleChars = '[]@\n'
		return not(c in unfeasibleChars)
	'''

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

	'''
	def get_orthographic_id(self, pos, dic, mode):
		if pos not in dic:
			dic[pos] = len(dic)

		return dic[pos]

	def get_prefix_id(self, token, mode):
		if(token[0].isupper()):
			return self.prefix_orthographic_features['capitalized']

		if(token[0].isdigit()):
			return self.prefix_orthographic_features['num']

		for prefix in self.prefixes:
			if(token.startswith(prefix)):
				return self.get_orthographic_id(prefix, self.prefix_orthographic_features, mode)

		return self.prefix_orthographic_features['nothing']


	def get_suffix_id(self, token, mode):
		if("-" in token):
			return self.suffix_orthographic_features['hyphenated']

		for suffix in self.suffixes:
			if(token.endswith(suffix)):
				return self.get_orthographic_id(suffix, self.suffix_orthographic_features, mode)

		return self.prefix_orthographic_features['nothing']
	'''

	## Process single file to get raw data matrix
	def processSingleFile(self, inFileName, mode):
		matrix = []
		row = []
		num_words = 0

		with open(inFileName) as f:
			lines = f.readlines()

			for line in lines:
				line = line.strip()
				is_clickbait = 0

				if line == '':
					pass
				else:
					tokens = line.split()
					row = []

					if(tokens[0] is "1"):
							is_clickbait = 1

					for token in tokens[1:]:
						feature = self.get_id(token, self.vocabulary, mode)

						#prefix_id = self.get_prefix_id(wordPosPair[0], mode)
						#suffix_id = self.get_suffix_id(wordPosPair[0], mode)

						#row.append((feature, self.get_id(wordPosPair[1], self.pos_tags, 'train'), prefix_id, suffix_id))

						row.append(feature, is_clickbait''', prefix_id, suffix_id''')
					
					matrix.append(row)

		return matrix


	## get all data files in given subdirectories of given directory
	def preProcessDirectory(self, inDirectoryName):
		files = glob.glob(inDirectoryName+'/*.txt')
		return list(files)

	## Get basic data matrix with (possibly) variable sized senteces, without padding
	def get_raw_data(self, files, mode):
		matrix = []

		for f in files:
			matrix.extend(self.processSingleFile(f, mode))

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

	## Get rid of sentences greater than max_size
	## and pad the remaining if less than max_size
	def get_processed_data(self, mat, max_size):
		X = []
		Y = []
		#PRE = []
		#SUF = []

		original_len = len(mat)
		mat = filter(lambda x: len(x) <= max_size, mat)
		no_removed = original_len - len(mat)

		for row in mat:
			X_row = [tup[0] for tup in row]
			Y_row = [tup[1] for tup in row]
			#PRE_row = [tup[2] for tup in row]
			#SUF_row = [tup[3] for tup in row]

			## padded words represented by len(vocab) + 1
			X_row += [self.get_pad_id(self.vocabulary)]*(max_size - len(X_row))

			## Padded pos tags represented by -1
			Y_row += [-1]*(max_size - len(Y_row))

			#PRE_row += ([self.prefix_orthographic_features['nothing']] * (max_size - len(PRE_row)))
			#SUF_row += ([self.suffix_orthographic_features['nothing']] * (max_size - len(SUF_row)))

			X.append(X_row)
			Y.append(Y_row)
			#PRE.append(PRE_row)
			#SUF.append(SUF_row)

		return X, Y, '''PRE, SUF,''' no_removed