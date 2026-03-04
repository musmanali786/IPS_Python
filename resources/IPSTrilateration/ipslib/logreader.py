import csv


def GetScanFromLogFile(fileName):
    print(fileName)
    listScans = []
    with open(fileName, 'r') as fileLog:
        reader = csv.reader(fileLog, delimiter=';')
        scanid = 0
        prvTag = "NONE"
        listBSSIDnRSSI = {}
        for apInfo in reader:
            # print(apInfo[0])
            if (len(apInfo) > 4):
                if apInfo[0] == "WIFI":
                    scanid = apInfo[2]
                    bssid = apInfo[4]
                    rssi = int(apInfo[5])
                    listBSSIDnRSSI[bssid] = rssi
                elif prvTag == "WIFI" and apInfo[0] != "WIFI":
                    listScans.append([scanid, listBSSIDnRSSI])
                    listBSSIDnRSSI = {}
                    break
                prvTag = apInfo[0]
        listBSSIDnRSSI = listScans[0][1]
        #print(listBSSIDnRSSI)
        return listBSSIDnRSSI


