import sys

clickbait = set()
nonclickbait = set()

with open("clickbait.in", "r") as f:
    for line in f:
        clickbait.add(line)

with open("non_clickbait.in", "r") as f:
    for line in f:
        nonclickbait.add(line)

allinput = set()
allinput = clickbait | nonclickbait

correct = 0
guesses = len(allinput)
for line in allinput:
    length = len(line.split(" ")) - 1
    if length > int(sys.argv[1]):
        # guess clickbait
        if line in clickbait:
            correct += 1
    else:
        if line in nonclickbait:
            correct += 1

print "Guesses: {0}".format(guesses)
print "Correct: {0}".format(correct)
print "Accuracy: {0}".format(float(correct) / float(guesses))

            
