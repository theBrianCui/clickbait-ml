import sys

firstwords = {}
with open(sys.argv[1], "r") as f:
    for line in f:
        first_word = line.split(" ")[0]
        if first_word not in firstwords:
            firstwords[first_word] = 1
        else:
            firstwords[first_word] = firstwords[first_word] + 1

for word in firstwords:
    print "{0},{1}".format(word, firstwords[word])

