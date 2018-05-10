def processFile(name):
    lines = []
    with open(name, "r") as f:
        for line in f:
            lines += [line]

    # accuracy
    print(lines[-4].split(" ")[-1][:-1], end=",")
    # loss
    print(lines[-3].split(" ")[-1][:-1], end=",")
    # precision
    print(lines[-2].split(" ")[-1][:-1], end=",")            
    # recall
    print(lines[-1].split(" ")[-1][:-1], end=",")
    print()

        
print("L,Accuracy,Loss,Precision,Recall")
for i in range(1, 20 + 1):
    print(str(i) + ",", end="")
    processFile("test{0}.out".format(i))
