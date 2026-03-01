close all;
clear all;


FileName = '';
PathName = '';


Lons0 = []
Lats0 = []
OdrGt = []
FlrGt = []

Lons = []
Lats = []
OdrRs = []
FlrRs = []

%for i =1:2
dirbrowse = '/home/ali/Desktop/MingYu/'
dirgt = uigetdir(dirbrowse, 'Select a gt folder');

gtjsonList = {}
resjsonList = {}
if ~isempty(dirgt)
  
   gtfiles = dir(fullfile(dirgt, '*.json'));
    % Display the names
    %gtfiles.name
    
    for i=1:length(gtfiles)
        FileName = gtfiles(i).name
        gtfilepath = fullfile(dirgt, FileName)
        gtjsondata = fileread(gtfilepath);
        gtjson = jsondecode(gtjsondata)
        gtjsonList{i} = gtjson
    end
    
end

dirres = uigetdir(dirbrowse, 'Select a RESULT folder');
if ~isempty(dirres)
  
   resfiles = dir(fullfile(dirres, '*.json'));
    % Display the names
    %gtfiles.name
    
    for i=1:length(resfiles)
        FileName = resfiles(i).name
        resfilepath = fullfile(dirres, FileName)
        resjsondata = fileread(resfilepath);
        resjson = jsondecode(resjsondata)
        resjsonList{i} = resjson
    end
    
end


for i=1:length(gtjsonList)
    gtjson = gtjsonList{i}
    for j=1:length(gtjson)
        Lons0 = [Lons0 gtjson(j).longitude]
        Lats0 = [Lats0 gtjson(j).latitude]  
        OdrGt = [OdrGt gtjson(j).no]
        FlrGt = [FlrGt gtjson(j).floor]
    end 
 
end




for i=1:length(resjsonList)
    resjson = resjsonList{i}
    for j=1:length(resjson)
        Lons = [Lons resjson(j).longitude]
        Lats = [Lats resjson(j).latitude]  
        OdrRs = [OdrRs resjson(j).no]
        FlrRs = [FlrRs resjson(j).floor]
    end 
 
end

%end

FloorErr = FlrRs

for i=1:7
    T = find(FlrRs == i)
    OutputTest(sprintf('ETRI-12  F %d, 2', i),Lats0(T), Lons0(T), Lats(T), Lons(T), FloorErr(T), 1, 0);
    
end

