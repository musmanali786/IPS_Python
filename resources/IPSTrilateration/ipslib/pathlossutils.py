import math
import numpy as np
def FromRSSIToDistance(rssi, rssi0=-32, method='default'):
    distance = 0
    if(method == 'default'):
        #rssidiff = rssi - rssi0
        #distance = math.pow(10,(rssidiff /(10 *2.4)))
        path_loss_exponent = 2.45  # Typical value for indoor environments

        # Calculate the distance ratio based on RSSI difference
        rssi_diff = rssi0 - rssi
        distance = 10 ** (rssi_diff / (10 * path_loss_exponent))

        # Estimate the unknown distance based on known distance and ratio
        #distance = 1 * distance_ratio  # 1 meter is the known distance

        # Print the estimated distance
        print(f"Estimated distance: {distance:.2f} meters")
    elif (method == 'default02'):

        # Define the equation variables
        f = 2.4  # Frequency in GHz
        FSPL = rssi * -1  # Free Space Path Loss in dB
        # Convert frequency to MHz
        f_mhz = f * 1000
        # Calculate the distance in kilometers
        distance_km = 10 ** ((FSPL - 20 * np.log10(f_mhz) + 32.44) / 20)
        # Convert distance to meters
        distance = distance_km * 1000


    return distance
