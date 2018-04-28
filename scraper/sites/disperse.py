counter = 0
with open("sites.in", "r") as f:  
  for site in f:
    if site.strip() == "":
      continue
    with open("sites_" + str(counter), "w") as f2:
      f2.write(site)
    counter += 1
