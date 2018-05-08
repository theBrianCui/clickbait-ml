import sys

qty = []
lines = 0
with open(sys.argv[1], "r") as f:
    for line in f:
        lines += 1
        tokens = line.split(" ")[:-1]
        qty += [len(tokens)]

qty.sort()

#print "Total words: {0}".format(qty)
print "Total lines: {0}".format(lines)
print "Min token count: {0}".format(qty[1])
