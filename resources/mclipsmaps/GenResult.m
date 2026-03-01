clear all
close all

Walk = 0;
OverAll = 0;
DataX = load('/home/ali/Desktop/ETRIWIFI/G6_WifiOutput.csv');
Data2 = load('/home/ali/Desktop/ETRIWIFI/S8_new_wifiOutput.csv');

%DataX = [Data1; Data2]

[~,idx] = sort(DataX(:,1)); % sort just the first column
Data = DataX(idx,:);   % sort the whole matrix using the sort indices

[C,ia,ic] = unique(Data(:,2));

Lats0 = Data(ia,2);
Lons0 = Data(ia,3);
Lats = Data(ia,4);
Lons = Data(ia,5);
FloorErr = Data(ia,6);

OutputTest(sprintf('ETRI-5'),Lats0, Lons0, Lats, Lons, FloorErr, 1, 0);

