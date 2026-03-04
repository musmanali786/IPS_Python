import cv2
import csv
import pandas as pd
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
    with open('RefPointsXYpixels.csv', 'r') as file:
        reader = csv.reader(file)
        for refPtInfo in reader:
            #print(gtPtInfo)
            if(refPtInfo[0] == "ID"):
                continue
            refNo = int(refPtInfo[0])
            refPtX = int(refPtInfo[1])
            refPtY = int(refPtInfo[2])
            refPtFile = refPtInfo[3]
            cv2.circle(img, (refPtX,refPtY), 4,(0, 0, 255), 2)
            cv2.putText(img, refPtFile, (refPtX + 15, refPtY + 15), cv2.QT_FONT_NORMAL, 0.5, (0, 0, 0), 1)


            fileName = refPtFile + '.txt'
            print(fileName)
            listScans=[]
            with open('logs/' + fileName, 'r') as fileGT:
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


                for line in lines:
                    if (len(line) > 3):
                        scaninfo = line.rstrip("\n").split('|')
                        posinfos = scaninfo[0].split(',');
                        _, PosX = posinfos[1].partition(":")[::2]
                        _, PosY = posinfos[2].partition(":")[::2]
                        _, PosZ = posinfos[3].partition(":")[::2]
                        # print(PosX)
                        apinfos = scaninfo[1].rstrip(';').split(';');
                        valuePairs = {'ScanNo': i, 'PosX': int(PosX), 'PosY': int(PosY), 'PosZ': int(PosZ)}
                        i = i + 1
                        # print(valuePairs)
                        for apinfo in apinfos:
                            valuePairs2 = valuePairs.copy();
                            infopairs = apinfo.rstrip("\n").split(',');
                            # print(infopairs)
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

# Step 2  transform raw db to fingerprint db

fpData = rawData.groupby(['PosX', 'PosY', 'PosZ', 'BSSID'])['RSSI'].mean()
# print(fpData)

fpData.to_csv('fpData.txt', sep=',')


listScans = [[1, listBSSIDnRSSI]]

for scan in listScans:
    onlineScan = scan[1]
    #print(onlineScan)
    # Step 5  Estimate Candidate Position Positions Using RMSE

    loc = (0,0)

    # Step 6  Display result on map

    posX = int(loc[0])  # ???
    posY = int(loc[1])  # ???
    cv2.circle(img, (posX, posY), 4, (0, 0, 0), 2)

    # example Line
    #cv2.line(img, (refPtX, refPtY), (posX, posY), (0, 255, 0), 2)


cv2.imshow('Output', img)

cv2.waitKey(0)
