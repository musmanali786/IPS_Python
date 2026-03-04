import cv2
import numpy as np
import csv
import pandas as pd
import matplotlib.pyplot as plt
import math

#
bMakeFPDB = 0 

# Step 1
img = cv2.imread('Map.png')
# height, width
height = img.shape[0]
width = img.shape[1]

print("Image Size (W,H):" , width , height)


# Step 1   Read Raw scan files

if bMakeFPDB:
    with open('resources/AvgLogScan.txt', 'r') as file:
        #file = open('abc.txt', mode='r', encoding='utf-8-sig')
        lines = file.readlines()
        file.close()
        data = []
        i = 1

    for line in lines:
            if(len(line)>3):
                scaninfo = line.rstrip("\n").split('|')
                posinfos = scaninfo[0].split(',');
                _, PosX = posinfos[1].partition(":")[::2]
                _, PosY = posinfos[2].partition(":")[::2]
                _, PosZ = posinfos[3].partition(":")[::2]
                #print(PosX)
                apinfos = scaninfo[1].rstrip(';').split(';');
                valuePairs= {'ScanNo': i, 'PosX': int(PosX), 'PosY': int(PosY), 'PosZ': int(PosZ)}
                i = i + 1
                #print(valuePairs)
                for apinfo in apinfos:
                    valuePairs2 = valuePairs.copy();
                    infopairs = apinfo.rstrip("\n").split(',');
                    #print(infopairs)
                    ssid, valSSID = infopairs[0].lstrip(" ").partition(":")[::2]
                    bssid, valBSSID = infopairs[1].lstrip(" ").partition(":")[::2]
                    freq, valFREQ = infopairs[4].lstrip(" ").partition(":")[::2]
                    rssi, valRSSI = infopairs[3].lstrip(" ").partition(":")[::2]
                    valuePairs2['SSID'] = valSSID.lstrip(" ")
                    valuePairs2['BSSID'] = valBSSID.lstrip(" ")
                    valuePairs2['FREQ'] = valFREQ.lstrip(" ")
                    valuePairs2['RSSI'] = int(valRSSI.lstrip(" "))
                    data.append(valuePairs2)

    rawData = pd.DataFrame(data)
    rawData.to_csv('rawData.txt', sep=',')

    #Step 2  transform raw db to fingerprint db

    fpData = rawData.groupby(['PosX','PosY','PosZ', 'BSSID'])['RSSI'].mean()
    #print(fpData)

    fpData.to_csv('fpData.txt', sep=',')

fpData = pd.read_csv('fpData.txt')
#print(fpData)
map = {}
for index, row in fpData.iterrows():
    #print(row['PosX'], row['BSSID'])
    key = row['PosX']
    RSSI = int(row['RSSI'])
    if key in map.keys():
        map[key][row['BSSID']] = RSSI
    else:
        map[key] = {row['BSSID']: RSSI}

print(map)
def distance(p1,p2):
    return math.sqrt( ((p1[0]-p2[0])**2)+((p1[1]-p2[1])**2) )
# Mean Square Error
# locations: [ (x1, y1), ... ]
# distances: [ distance1, ... ]
def mse(x, locations, distances):
    mse = 0.0
    for location, dist in zip(locations, distances):
        distance_calculated = distance(x, location)
        mse += math.pow(distance_calculated - dist, 2.0)
    return mse / len(distances) # len(data)

ErrorList = []

def sortonerror(e):
  return e[-1]


#Step 3  Read test pos file

# GT Points
def GetCandidatePos(online, fpdb):
    candidates = []
    for key in fpdb.keys():
        candidate = fpdb[key]
        errRSSI = []
        k = 12
        for bssid in candidate.keys():
            if bssid in online.keys():
                if k == 0:
                    break
                k=k-1
                errRSSI.append(abs(candidate[bssid] - online[bssid]))
        average = sum(errRSSI) / len(errRSSI)
        candidates.append([key, average])

    # Step  select final position candidate
    candidates.sort(key=sortonerror)
    return candidates[0]


def TranformLoc(locx):
    return [RFPoints[locx][0], RFPoints[locx][1]]

RFPoints={}
with open('resources/gtpoints.csv', 'r') as file:
    reader = csv.reader(file)
    for RFPtInfo in reader:
        key = int(RFPtInfo[0])
        RFPtX = int(RFPtInfo[1])
        RFPtY = int(RFPtInfo[2])
        RFPtZ = int(RFPtInfo[3])
        RFPoints[key] = [RFPtX, RFPtY, RFPtZ]

#print(RFPoints)
with open('resources/TestPoints.csv', 'r') as file:
    reader = csv.reader(file)
    for gtPtInfo in reader:
        #print(gtPtInfo)
        gtPtX = int(gtPtInfo[2])
        gtPtY = int(gtPtInfo[3])
        gtPtFile = gtPtInfo[1]
        cv2.circle(img, (gtPtX,gtPtY), 4,(0, 0, 255), 2)
        cv2.putText(img, gtPtFile, (gtPtX + 15, gtPtY + 15), cv2.QT_FONT_NORMAL, 0.5, (0, 0, 0), 1)


        fileName = 'logfile_2020_06_05_12_' + gtPtFile
        listScans=[]
        with open('resources/' + fileName, 'r') as fileGT:
            reader = csv.reader(fileGT, delimiter=';')
            scanid = 0
            prvTag = "NONE"
            listBSSIDnRSSI = {}
            for apInfo in reader:
                #print(apInfo[0])
                if(len(apInfo)>4):
                    if apInfo[0] == "WIFI":
                        scanid = apInfo[2]
                        bssid = apInfo[4]
                        rssi = int(apInfo[5])
                        listBSSIDnRSSI[bssid] = rssi
                    elif prvTag == "WIFI" and apInfo[0] != "WIFI":
                        listScans.append([scanid,listBSSIDnRSSI])
                        listBSSIDnRSSI = {}
                    prvTag = apInfo[0]
            listBSSIDnRSSI = listScans[0][1]
            print(listBSSIDnRSSI)

            listScans = [[1, listBSSIDnRSSI]]

            for scan in listScans:
                onlineScan = scan[1]
            #print(onlineScan)
                # Step 5  Estimate Candidate Position Positions Using RMSE

                locx,errRSSI = GetCandidatePos(onlineScan, map)

                loc = TranformLoc(locx)

                # Step 6  Display result on map

                posX = int(loc[0])  # ???
                posY = int(loc[1])  # ???
                cv2.circle(img, (posX, posY), 4, (0, 0, 0), 2)

                # example Line
                cv2.line(img, (gtPtX, gtPtY), (posX, posY), (0, 255, 0), 2)
                ErrorList.append(abs(distance((posX, posY),(gtPtX, gtPtY))/20))

cv2.imshow('Output', img)

cv2.waitKey(0)

print(ErrorList)
def cdf(x, plot=True, *args, **kwargs):
    x, y = sorted(x), np.arange(len(x)) / len(x)
    return plt.plot(x, y, *args, **kwargs) if plot else (x, y)

cdf(ErrorList) # calculate the cdf - also discrete
plt.show()


