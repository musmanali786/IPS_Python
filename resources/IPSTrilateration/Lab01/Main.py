import math
import os
import sys
from pprint import pprint
import matplotlib.pyplot as plt
import numpy as np
import csv

# Add parent directory to path so ipslib can be found
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ipslib.logreader import GetScanFromLogFile
from ipslib.pathlossutils import FromRSSIToDistance

class App():
    def __init__(self, rows, txpower):
        self.empty_rows = rows
        self.txpower = txpower

    def get_data_lines_from_file(self, path):
        rv = []
        with open(path) as f:
            lines = f.readlines()

        return lines

    def format_lines(self, lines):
        rv = []
        # columns are separated by whitespace, so remove it and place values in a list
        for i in range(len(lines)):
            lines[i] = ' '.join(lines[i].split()).split()

        # extracting columns names from the top
        column_names = lines[0]

        # removing rows with no data
        lines = lines[self.empty_rows - 1:]

        for line in lines:
            result = {}
            for i in range(len(line)):
                result.update({
                    column_names[i]: line[i],
                }
                )
            rv.append(result)
        return rv[1:]

    def calculate_distance(self, rssi):
        ratio = (self.txpower - int(rssi)) / 40
        distance = math.pow(10, ratio)
        return distance


if __name__ == '__main__':

    # Change to the script's directory so relative paths work
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Define the filename
    fileAPs = "APs.csv"

    # Define line style for dotted circle
    line_style = 'dashed'  # You can also use 'dotted'

    # Create the plot with desired height and width (in inches)
    plt.figure(figsize=(15, 15))  # Adjust these values as needed

    ap_points = []
    ap_infos  = []
    with open(fileAPs, 'r') as csvfile:
        lines = csv.reader(csvfile)
        #next(reader)  # Skip header row (assuming the file has a header)
        for row in lines:
            # Assuming ID, X, Y, Desc format
            ssid, x, y, bssid = row  # Extract X and Y from columns 1 and 2 (index 0-based)
            ap_points.append([float(x), float(y)])
            ap_infos.append([ssid, float(x), float(y), bssid])

    # Convert data points to NumPy array
    ap_array = np.array(ap_points)

    # Extract X and Y coordinates
    X = ap_array[:, 0]
    Y = ap_array[:, 1]

    # Create the plot
    plt.plot(X, Y, marker='o', linestyle='', color='red', label='Data Points')


    # Define the filename
    fileRefPts = "RefsPts.csv"

    ref_points = []
    ref_ptsinfo = []
    with open(fileRefPts, 'r') as csvfile:
        reader = csv.reader(csvfile)
        #next(reader)  # Skip header row (assuming the file has a header)
        for row in reader:
            # Assuming ID, X, Y, Desc format
            refno, x, y, filetag = row  # Extract X and Y from columns 1 and 2 (index 0-based)
            ref_points.append([float(x), float(y)])
            ref_ptsinfo.append([int(refno), float(x), float(y), filetag, 0, 0])
    # Convert data points to NumPy array
    pts_array = np.array(ref_points)

    # Extract X and Y coordinates
    RefX = pts_array[:, 0]
    RefY = pts_array[:, 1]

    # Create the plot
    plt.plot(RefX, RefY, marker='x', linestyle='', color='blue', label='Data Points')
    # Create circle object with center and radius

    rectangle = plt.Rectangle((0, 0), 13, 13, color='black', linestyle=line_style, fill=False)
    # Add circle to the plot
    plt.gca().add_patch(rectangle)

    for refinfo in ref_ptsinfo:

        bssidrssilist = GetScanFromLogFile('../dataset/logfile_'+refinfo[3]+'.txt')

        #print(bssidrssilist[ap_infos[0][3]],bssidrssilist[ap_infos[1][3]],bssidrssilist[ap_infos[2][3]],)
        d1 = FromRSSIToDistance(bssidrssilist[ap_infos[0][3]],method='default')
        d2 = FromRSSIToDistance(bssidrssilist[ap_infos[1][3]],method='default')
        d3 = FromRSSIToDistance(bssidrssilist[ap_infos[2][3]],method='default')

        #print(d1," ",d2," ",d3)
        #print(refinfo)

        # chans algo here

        #x, y =  getlocationbychan();


        if(refinfo[0] == 2):
            circle = plt.Circle((X[0],Y[0]), d1, color='red', linestyle=line_style, fill= False)
            # Add circle to the plot
            plt.gca().add_patch(circle)

            circle = plt.Circle((X[1],Y[1]), d2, color='red', linestyle=line_style, fill= False)
            # Add circle to the plot
            plt.gca().add_patch(circle)

            circle = plt.Circle((X[2],Y[2]), d3, color='red', linestyle=line_style, fill= False)
            # Add circle to the plot
            plt.gca().add_patch(circle)



    # Add labels and title
    plt.xlabel("X-axis")
    plt.ylabel("Y-axis")
    plt.title("Data Points from File")

    # Fit axes: equal aspect ratio and auto-scale with padding
    plt.gca().set_aspect('equal', adjustable='datalim')
    plt.autoscale(enable=True)
    margin = 2
    plt.xlim(-margin, 13 + margin)
    plt.ylim(-margin, 13 + margin)

    # Add legend (optional)
    plt.legend()

    # Show the plot fitted to window
    plt.grid(True)
    plt.tight_layout()
    plt.show()
    #app = App(rows=2, txpower=-40)

    #data = app.get_data_lines_from_file('test.txt')
    #formatted_data = [] #app.format_lines(data)

    #try:

    #    for i in range(len(formatted_data)):
    #        rssi = formatted_data[i]['RSSI']
    #        distance = app.calculate_distance(rssi)
    #        formatted_data[i].update({'distance': distance})

    #except KeyError:
    #    print("No RSSI value in a file")

    #pprint(formatted_data)