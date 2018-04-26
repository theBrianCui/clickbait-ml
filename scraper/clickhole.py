base = "https://news.clickhole.com/?startTime="

a = 1522251360235
for i in range(300):
    print(base + str(a - 10000*i))
    