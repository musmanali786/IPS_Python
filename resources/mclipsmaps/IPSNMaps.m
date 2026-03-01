function varargout = IPSNMaps(varargin)
% IPSNMAPS MATLAB code for IPSNMaps.fig
%      IPSNMAPS, by itself, creates a new IPSNMAPS or raises the existing
%      singleton*.
%
%      H = IPSNMAPS returns the handle to a new IPSNMAPS or the handle to
%      the existing singleton*.
%
%      IPSNMAPS('CALLBACK',hObject,eventData,handles,...) calls the local
%      function named CALLBACK in IPSNMAPS.M with the given input arguments.
%
%      IPSNMAPS('Property','Value',...) creates a new IPSNMAPS or raises the
%      existing singleton*.  Starting from the left, property value pairs are
%      applied to the GUI before IPSNMaps_OpeningFcn gets called.  An
%      unrecognized property name or invalid value makes property application
%      stop.  All inputs are passed to IPSNMaps_OpeningFcn via varargin.
%
%      *See GUI Options on GUIDE's Tools menu.  Choose "GUI allows only one
%      instance to run (singleton)".
%
% See also: GUIDE, GUIDATA, GUIHANDLES

% Edit the above text to modify the response to help IPSNMaps

% Last Modified by GUIDE v2.5 04-Apr-2018 20:40:35

% Begin initialization code - DO NOT EDIT
gui_Singleton = 1;
gui_State = struct('gui_Name',       mfilename, ...
                   'gui_Singleton',  gui_Singleton, ...
                   'gui_OpeningFcn', @IPSNMaps_OpeningFcn, ...
                   'gui_OutputFcn',  @IPSNMaps_OutputFcn, ...
                   'gui_LayoutFcn',  [] , ...
                   'gui_Callback',   []);
if nargin && ischar(varargin{1})
    gui_State.gui_Callback = str2func(varargin{1});
end

if nargout
    [varargout{1:nargout}] = gui_mainfcn(gui_State, varargin{:});
else
    gui_mainfcn(gui_State, varargin{:});
end
% End initialization code - DO NOT EDIT

% --- Executes just before IPSNMaps is made visible.
function IPSNMaps_OpeningFcn(hObject, eventdata, handles, varargin)
% This function has no output args, see OutputFcn.
% hObject    handle to figure
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
% varargin   command line arguments to IPSNMaps (see VARARGIN)

% Choose default command line output for IPSNMaps
handles.output = hObject;

% Update handles structure
guidata(hObject, handles);

% This sets up the initial plot - only do when we are invisible
% so window can get raised using IPSNMaps.
if strcmp(get(hObject,'Visible'),'off')
    plot(rand(5));
end

% UIWAIT makes IPSNMaps wait for user response (see UIRESUME)
% uiwait(handles.figure1);


% --- Outputs from this function are returned to the command line.
function varargout = IPSNMaps_OutputFcn(hObject, eventdata, handles)
% varargout  cell array for returning output args (see VARARGOUT);
% hObject    handle to figure
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Get default command line output from handles structure
varargout{1} = handles.output;

% --- Executes on button press in pbLoadJSON.
function pbUpdate_Callback(hObject, eventdata, handles)
% hObject    handle to pbLoadJSON (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
axes(handles.axes1);
cla;

handles.currFloorNo = get(handles.pumFloors, 'Value');

FileName =  handles.mapjson.floors(handles.currFloorNo).FloorMap;

img = imread(FileName);
[Height,Width] = size(img);
axis([0 Width 0 Height]);
imshow(img,'InitialMagnification','fit')
handles.map = img;
%imshow(img);
hold on
grid on
guidata(hObject, handles);

% --------------------------------------------------------------------
function FileMenu_Callback(hObject, eventdata, handles)
% hObject    handle to FileMenu (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)


% --------------------------------------------------------------------
function OpenMenuItem_Callback(hObject, eventdata, handles)
% hObject    handle to OpenMenuItem (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
file = uigetfile('*.fig');
if ~isequal(file, 0)
    open(file);
end

% --------------------------------------------------------------------
function PrintMenuItem_Callback(hObject, eventdata, handles)
% hObject    handle to PrintMenuItem (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
printdlg(handles.figure1)

% --------------------------------------------------------------------
function CloseMenuItem_Callback(hObject, eventdata, handles)
% hObject    handle to CloseMenuItem (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
selection = questdlg(['Close ' get(handles.figure1,'Name') '?'],...
                     ['Close ' get(handles.figure1,'Name') '...'],...
                     'Yes','No','Yes');
if strcmp(selection,'No')
    return;
end

delete(handles.figure1)


% --- Executes on selection change in pumFloors.
function pumFloors_Callback(hObject, eventdata, handles)
% hObject    handle to pumFloors (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: contents = get(hObject,'String') returns pumFloors contents as cell array
%        contents{get(hObject,'Value')} returns selected item from pumFloors
popup_sel_index = get(hObject, 'Value');

handles.currFloorNo = popup_sel_index

FileName =  handles.mapjson.floors(handles.currFloorNo).FloorMap;

img = imread(FileName);
[Height,Width] = size(img);
imshow(img,'InitialMagnification','fit')

handles.map = img;
%imshow(img);
hold on
grid on
guidata(hObject, handles);


% --- Executes during object creation, after setting all properties.
function pumFloors_CreateFcn(hObject, eventdata, handles)
% hObject    handle to pumFloors (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    empty - handles not created until after all CreateFcns called

% Hint: popupmenu controls usually have a white background on Windows.
%       See ISPC and COMPUTER.
if ispc && isequal(get(hObject,'BackgroundColor'), get(0,'defaultUicontrolBackgroundColor'))
     set(hObject,'BackgroundColor','white');
end

%set(hObject, 'String', {'plot(rand(5))', 'plot(sin(1:0.01:25))', 'bar(1:.5:10)', 'plot(membrane)', 'surf(peaks)'});

% --- Executes on button press in pbLoadJSON.
function pbLoadJSON_Callback(hObject, eventdata, handles)
% hObject    handle to pbLoadJSON (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
% --- Executes on button press in pbLoadJSON.



FileName = '';
PathName = '';

[MapFileName,PathName] = uigetfile({'*.json','JSON MAP Files';...
              '*.*','All Files' },'Select the json map file',...
              '.');

if isequal(FileName,0)
   PathName = '.'
   MapFileName = 'JSON.json';
end

set(handles.txtTitle,'String',  MapFileName)


handles.mapfilepath = fullfile(PathName, MapFileName)

mapjson = fileread(handles.mapfilepath);

handles.mapjson = jsondecode(mapjson)

    
FloorsDesc = [];
for i=1:length(handles.mapjson.floors)
    FloorsDesc = [FloorsDesc string(handles.mapjson.floors(i).Description)];
end

set(handles.pumFloors, 'String',  FloorsDesc)
set(handles.pumFloors, 'Value',  1)

handles.currFloorNo = 1

FileName = handles.mapjson.floors(handles.currFloorNo).FloorMap;

img = imread(fullfile(FileName));
[Height,Width] = size(img);
axis([0 Width 0 Height]);
imshow(img,'InitialMagnification','fit')
handles.map = img;
%imshow(img);
hold on
grid on



%handles.mapfilepath 

guidata(hObject, handles);


function pbLoadMap_Callback(hObject, eventdata, handles)
% hObject    handle to pbLoadJSON (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

axes(handles.axes1);
%cla;

[FileName,PathName] = uigetfile({'*.jpg','JPG Image Files';'*.bmp','BMP Image Files';...
          '*.*','All Files' },'Select the map image file',...
          '.\ITPixelMap.bmp');
      
if isequal(FileName,0)
   disp('User selected Cancel')
else
    img = imread(fullfile(PathName, FileName));   
    
    handles.map = rgb2gray(img);
    [Height Width] = size(handles.map(:,:,1))
    handles.mapjson.floors(handles.currFloorNo).Height = Height
    handles.mapjson.floors(handles.currFloorNo).Width = Width
     
    %axis([0 Width 0 Height]);
    imshow(img,'InitialMagnification','fit')

    %imshow(img);
    hold on
    grid on
    
    %FileJSONName = replace(FileName,'.bmp','.json')
    %handles.mapfilepath = fullfile(PathName, FileJSONName)
    
    %imgjson = fileread('JSON.json');
    
    %if exist(handles.mapfilepath, 'file') == 2        
    %    imgjson = fileread(handles.mapfilepath)
    %end

    % handles.mapjson = jsondecode(imgjson)
    handles.mapjson.floors(handles.currFloorNo).FloorMap = FileName
    % Update handles structure
 
 
    
end

guidata(hObject, handles);


% --- Executes on button press in pbSelectArea.
function pbSelectArea_Callback(hObject, eventdata, handles)
% hObject    handle to pbSelectArea (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
rect = getrect
prompt = {'Width in meters:','Height in meters:'};
dlg_title = 'Input';
num_lines = 1;
defaultans = {num2str(rect(3)/10),num2str(rect(4)/10)};
answer = inputdlg(prompt,dlg_title,num_lines,defaultans);
width  =  str2double(answer(1))
height =  str2double(answer(2))

dw = rect(3)/width;
dh = rect(4)/height;


Cen = rect(:,1:2);

handles.mapjson.floors(handles.currFloorNo).rect = rect;
handles.mapjson.floors(handles.currFloorNo).xdelta = dw;
handles.mapjson.floors(handles.currFloorNo).ydelta = dh;

x = [rect(1):dw:rect(1)+rect(3)];% x = [1:6];
y = [rect(2):dh:rect(2)+rect(4)];% y = [1:4];

[X,Y] = meshgrid(x,y);

loc = [reshape(X+dw/2,1,[]);reshape(Y+dh/2,1,[])];


map = handles.map;
map = rgb2gray(map);
map = imcomplement(map);

handles.X = X;
handles.loc = loc;
handles.Y = Y;
handles.d = [dw dh];

for i=1:length(loc(1,:))
    rectangle('Position',[loc(1,i)-1,loc(2,i)-1,1,1],'Curvature',[1 1])
end

% path.name = 'All';
% path.points.x = loc(1,:);
% path.points.y = loc(2,:);
% path.points.z = zeros(1,length(loc(1,:)));
% handles.mapjson.floors(handles.currFloorNo).path_list(1) = path

guidata(hObject, handles);

%Note that size(Z) is the same as size(x) and size(y)
%[EstMap, AP] = EstRSSIValueAt(map, Cen, d, loc, APLoc);

function editGridWidth_Callback(hObject, eventdata, handles)
% hObject    handle to editGridWidth (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: get(hObject,'String') returns contents of editGridWidth as text
%        str2double(get(hObject,'String')) returns contents of editGridWidth as a double


% --- Executes during object creation, after setting all properties.
function editGridWidth_CreateFcn(hObject, eventdata, handles)
% hObject    handle to editGridWidth (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    empty - handles not created until after all CreateFcns called

% Hint: edit controls usually have a white background on Windows.
%       See ISPC and COMPUTER.
if ispc && isequal(get(hObject,'BackgroundColor'), get(0,'defaultUicontrolBackgroundColor'))
    set(hObject,'BackgroundColor','white');
end



function editGridHeight_Callback(hObject, eventdata, handles)
% hObject    handle to editGridHeight (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: get(hObject,'String') returns contents of editGridHeight as text
%        str2double(get(hObject,'String')) returns contents of editGridHeight as a double


% --- Executes during object creation, after setting all properties.
function editGridHeight_CreateFcn(hObject, eventdata, handles)
% hObject    handle to editGridHeight (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    empty - handles not created until after all CreateFcns called

% Hint: edit controls usually have a white background on Windows.
%       See ISPC and COMPUTER.
if ispc && isequal(get(hObject,'BackgroundColor'), get(0,'defaultUicontrolBackgroundColor'))
    set(hObject,'BackgroundColor','white');
end


% --- Executes on button press in pbAddPath.
function pbAddPath_Callback(hObject, eventdata, handles)
% hObject    handle to pbAddPath (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)



[p,q] = getline
line(p,q,'color',[0.8 0.8 0.8]);


prompt = {'Delta in meters:','Path Name:'};
dlg_title = 'Input';
num_lines = 1;
defaultans = {num2str(1),'Path_XX'};
answer = inputdlg(prompt,dlg_title,num_lines,defaultans);
delta  =  str2double(answer(1))
name =  string(answer(2))
X =[]
Y =[]


dw = handles.mapjson.floors(handles.currFloorNo).xdelta;
dh = handles.mapjson.floors(handles.currFloorNo).ydelta;

npath = length(p)-1;
for i=1:npath
    x = p(i:i+1)
    y = q(i:i+1)

    ax = abs(x(2) - x(1)) * dh;
    ay = abs(y(2) - y(1)) * dw;


    sX = 1;
    if(x(1)>x(2))
        sX = -1;
    end

    sY = 1;
    if(y(1)>y(2))
        sY = -1;
    end

    if(ax < 1)
        cY = y(1):dh*sY:y(2)
        Y = [Y cY]  
        X = [X ones(1,length(cY)) * x(1)]
    elseif (ay < 1)
        cX = x(1):dw*sX:x(2)
        X = [X cX]
        Y = [Y ones(1,length(cX)) * y(1)]
    else
        theta = atan( ay/ax )    
        dx = delta * dw * cos(theta)
        dy = delta * dh * sin(theta)
        X = [X x(1):dx*sX:x(2)]
        Y = [Y y(1):dy*sY:y(2)]
    end

end

for i=1:length(X)
    a = X(i);
    b = Y(i);
    rectangle('Position',[a-1,b-1,3,3],'FaceColor',[1 0 0],'EdgeColor','b')
end
%path.name2 = 'abcd'
path.name = cell2mat(name);
path.points.x = X;
path.points.y = Y;
path.points.z = zeros(1,length(X));


currFloor =  handles.mapjson.floors(handles.currFloorNo);
len = 1;
if isfield(currFloor, 'path_list')        
    len = length(currFloor.path_list)
else
    currFloor.path_list(1) = path;
end

len = len +1;

    
currFloor.path_list(len) = path
handles.mapjson.floors(handles.currFloorNo) = currFloor
names = {}
for k = 1 : len
  names(k,1) = cellstr(currFloor.path_list(k).name)
end

set(handles.lbAPList, 'String', names);


guidata(hObject, handles);

% --- Executes on selection change in lbLoadAPList.
function lbLoadAPList_Callback(hObject, eventdata, handles)
% hObject    handle to lbLoadAPList (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: contents = cellstr(get(hObject,'String')) returns lbLoadAPList contents as cell array
%        contents{get(hObject,'Value')} returns selected item from lbLoadAPList




% --- Executes during object creation, after setting all properties.
function lbLoadAPList_CreateFcn(hObject, eventdata, handles)
% hObject    handle to lbLoadAPList (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    empty - handles not created until after all CreateFcns called

% Hint: listbox controls usually have a white background on Windows.
%       See ISPC and COMPUTER.
if ispc && isequal(get(hObject,'BackgroundColor'), get(0,'defaultUicontrolBackgroundColor'))
    set(hObject,'BackgroundColor','white');
end


% --- Executes on selection change in lbAPList.
function lbAPList_Callback(hObject, eventdata, handles)
% hObject    handle to lbAPList (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: contents = cellstr(get(hObject,'String')) returns lbAPList contents as cell array
%        contents{get(hObject,'Value')} returns selected item from lbAPList


contents = cellstr(get(hObject,'String'))
index = get(hObject,'Value')
UserData = cellstr(get(hObject,'UserData'))
handles.BSSID = UserData{index}
set(handles.txtBSSID,'String',  UserData{index})


X = handles.APList{2}

if(X(index) == -1)
    [x,y] = getpts    
    handles.APList{2}(index) = x;
    handles.APList{3}(index) = y;
    rectangle('Position',[x-1,y-1,3,3],'FaceColor',[1 0 0],'EdgeColor','b')
end

handles.APLoc = [handles.APList{2}(index) handles.APList{3}(index)];
% Update handles structure
guidata(hObject, handles);

% --- Executes during object creation, after setting all properties.
function lbAPList_CreateFcn(hObject, eventdata, handles)
% hObject    handle to lbAPList (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    empty - handles not created until after all CreateFcns called

% Hint: listbox controls usually have a white background on Windows.
%       See ISPC and COMPUTER.
if ispc && isequal(get(hObject,'BackgroundColor'), get(0,'defaultUicontrolBackgroundColor'))
    set(hObject,'BackgroundColor','white');
end


% --- Executes on button press in pbSaveMap.
function pbSaveMap_Callback(hObject, eventdata, handles)
% hObject    handle to pbSaveMap (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
handles.mapjson
jsondata = jsonencode(handles.mapjson)
fileID = fopen(handles.mapfilepath,'w+');
fprintf(fileID,jsondata);
%fprintf(fileID,'%s\n','jsondata');
fclose(fileID);


% --- Executes on button press in bpStartServer.
function bpStartServer_Callback(hObject, eventdata, handles)
% hObject    handle to bpStartServer (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)



% --- Executes on button press in pbDeleteSelectedPath.
function pbDeleteSelectedPath_Callback(hObject, eventdata, handles)
% hObject    handle to pbDeleteSelectedPath (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)



function editPathName_Callback(hObject, eventdata, handles)
% hObject    handle to editPathName (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: get(hObject,'String') returns contents of editPathName as text
%        str2double(get(hObject,'String')) returns contents of editPathName as a double


% --- Executes during object creation, after setting all properties.
function editPathName_CreateFcn(hObject, eventdata, handles)
% hObject    handle to editPathName (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    empty - handles not created until after all CreateFcns called

% Hint: edit controls usually have a white background on Windows.
%       See ISPC and COMPUTER.
if ispc && isequal(get(hObject,'BackgroundColor'), get(0,'defaultUicontrolBackgroundColor'))
    set(hObject,'BackgroundColor','white');
end


% --- If Enable == 'on', executes on mouse press in 5 pixel border.
% --- Otherwise, executes on mouse press in 5 pixel border or over pbSelectArea.
function pbSelectArea_ButtonDownFcn(hObject, eventdata, handles)
% hObject    handle to pbSelectArea (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)


% --- Executes on button press in pbSetPoints.
function pbSetPoints_Callback(hObject, eventdata, handles)
% hObject    handle to pbSetPoints (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

%handles.mapjson.floors(handles.currFloorNo).map = rgb2gray(handles.map);
[width height] = size(handles.map(:,:,1));

[x, y] = getline;
lat = handles.mapjson.floors(handles.currFloorNo).origin.latlon(1)
lon = handles.mapjson.floors(handles.currFloorNo).origin.latlon(2)
[arclen, az] = distance(lat, lon,...
handles.mapjson.floors(handles.currFloorNo).point.latlon(1), handles.mapjson.floors(handles.currFloorNo).point.latlon(2), 'radians')

ltaz = pi - atan(y(1)/x(1)) + az
rtaz = atan(y(1)/width - x(1)) + az
ltarclen = sqrt(y(1)^2 + x(1)^2)
rtarclen = sqrt(y(1)^2 + (width - x(1))^2)
[ltlat, ltlon] = reckon(lat, lon, ltarclen, ltaz, 'radians');
[rtlat, rtlon] = reckon(lat, lon, rtarclen, rtaz, 'radians');

[arclen, az] = distance(ltlat, ltlon, rtlat, rtlon, 'radians');

handles.mapjson.floors(handles.currFloorNo).topleft(1) = ltlat;
handles.mapjson.floors(handles.currFloorNo).topleft(2) = ltlon;
handles.mapjson.floors(handles.currFloorNo).angle = az;


handles.mapjson.floors(handles.currFloorNo).height = height / handles.d(2);
handles.mapjson.floors(handles.currFloorNo).width = width / handles.d(1);


line(x, y,'color',[1 0 0]);

handles.mapjson.floors(handles.currFloorNo).origin.XYZ(1) = x(1)
handles.mapjson.floors(handles.currFloorNo).origin.XYZ(2) = y(1)

handles.mapjson.floors(handles.currFloorNo).point.XYZ(1)  = x(2)
handles.mapjson.floors(handles.currFloorNo).point.XYZ(2) = y(2)

guidata(hObject, handles);


% --- Executes on button press in pbNewMap.
function pbNewMap_Callback(hObject, eventdata, handles)
% hObject    handle to pbNewMap (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
prompt = {'Name:','Description:','BuildingID:'};
dlg_title = 'Input';
num_lines = 1;
defaultans = {'New Building','Building',num2str(3)};
answer = inputdlg(prompt,dlg_title,num_lines,defaultans);
FileName =  string(answer(1));
desc  =  string(answer(2));
buildingID  =  str2double(answer(3));
FileJSONName = replace(FileName,' ','_');
handles.mapfilepath = strcat(FileJSONName,'.json');
set(handles.txtTitle,'String',  FileName)
handles.mapjson.Description = desc;
handles.mapjson.BuildingID = buildingID;

handles.mapjson.floors = [];

floorno = 1;

FileName = '';
PathName = '';

while(1)

    %%your code here
    choice = menu('Add a Floor Plan to Building Press yes no','Yes','No');
    if choice==2 | choice==0
       break;
    end

    prompt = {'Floor Description:','Floor ID.'};
    dlg_title = 'Input';
    num_lines = 1;
    defaultans = {'F1',num2str(floorno)};
    answer = inputdlg(prompt,dlg_title,num_lines,defaultans);
    floordesc =  string(answer(1));

    handles.mapjson.floors(floorno).Description = floordesc;
    handles.mapjson.floors(floorno).FloorID = floorno;
    
    handles.mapjson.floors(floorno).origin.latlon(1) = 0.01
    handles.mapjson.floors(floorno).origin.latlon(2) = 0.01
    handles.mapjson.floors(floorno).origin.XYZ(1) = 0.01
    handles.mapjson.floors(floorno).origin.XYZ(2) = 0.01

    handles.mapjson.floors(floorno).point.latlon(1)  = 0.01
    handles.mapjson.floors(floorno).point.latlon(2) = 0.01
    handles.mapjson.floors(floorno).point.XYZ(1)  = 0.01
    handles.mapjson.floors(floorno).point.XYZ(2) = 0.01

    [FileName,PathName] = uigetfile({'*.jpg','JPG Image Files';'*.bmp','BMP Image Files';...
              '*.*','All Files' },'Select the map image file',...
              '.\ITPixelMap.bmp');

    if isequal(FileName,0)
       handles.mapjson.floors(floorno).FloorMap = 'sample.bmp';
    else

     handles.mapjson.floors(floorno).FloorMap = FileName;
     img = imread(fullfile(PathName, FileName));
     
    handles.map = rgb2gray(img);
    [Height Width] = size(handles.map(:,:,1));

     handles.mapjson.floors(floorno).Height = Height;
     handles.mapjson.floors(floorno).Width = Width;
    end
    
    defpath.name = 'Grid';
    defpath.points.x = [0 Width];
    defpath.points.y = [0 Height];
    defpath.points.z = [0 0];
    
    handles.mapjson.floors(floorno).path_list(1) = defpath;
    
    handles.mapjson.version = 1.01;
    handles.currFloorNo = floorno;
    floorno = floorno + 1;
end
FloorsDesc = []
for i=1:length(handles.mapjson.floors)
    FloorsDesc = [FloorsDesc handles.mapjson.floors(i).Description]
end

set(handles.pumFloors, 'String',  FloorsDesc)
set(handles.pumFloors, 'Value',  floorno-1)

img = imread(fullfile(PathName, FileName));
handles.map = rgb2gray(img);
[Height Width]  = size(handles.map(:,:,1));
axis([0 Width 0 Height]);
imshow(img,'InitialMagnification','fit')
handles.map = img;
%imshow(img);
hold on
grid on



%handles.mapfilepath 

jsondata = jsonencode(handles.mapjson)
fileID = fopen(handles.mapfilepath,'w+');
fprintf(fileID,jsondata);
%fprintf(fileID,'%s\n','jsondata');
fclose(fileID);

guidata(hObject, handles);
