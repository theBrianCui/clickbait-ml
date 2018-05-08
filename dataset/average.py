import sys

qty = 0
lines = 0
with open(sys.argv[1], "r") as f:
    for line in f:
        lines += 1
        tokens = line.split(" ")[:-1]
        qty += len(tokens)

print "Total words: {0}".format(qty)
print "Total lines: {0}".format(lines)
print "Average token count: {0}".format(float(qty) / float(lines))


