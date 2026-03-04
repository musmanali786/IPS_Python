import math


def calculate_distance(rssi_at_1m, rssi_at_unknown, path_loss_exponent=2):
    """
    Calculate the distance based on RSSI values using the log-distance path loss model.

    :param rssi_at_1m: RSSI value at 1 meter distance (dBm)
    :param rssi_at_unknown: RSSI value at the unknown distance (dBm)
    :param path_loss_exponent: Path loss exponent (environmental factor)
                               2 is for free space, 2.7 to 3.5 for urban areas, etc.
    :return: Estimated distance in meters
    """
    # Calculate the distance
    distance = 10 ** ((rssi_at_1m - rssi_at_unknown) / (10 * path_loss_exponent))
    return distance


# Example usage
rssi_at_1m = -40  # Example RSSI value at 1 meter (in dBm)
rssi_at_unknown = -60  # Example RSSI value at unknown distance (in dBm)

estimated_distance = calculate_distance(rssi_at_1m, rssi_at_unknown)
print(f"Estimated distance: {estimated_distance} meters")