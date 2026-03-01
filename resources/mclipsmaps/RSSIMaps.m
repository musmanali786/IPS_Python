function varargout = RSSIMaps(varargin)
% RSSIMAPS MATLAB code for RSSIMaps.fig
%      RSSIMAPS, by itself, creates a new RSSIMAPS or raises the existing
%      singleton*.
%
%      H = RSSIMAPS returns the handle to a new RSSIMAPS or the handle to
%      the existing singleton*.
%
%      RSSIMAPS('CALLBACK',hObject,eventData,handles,...) calls the local
%      function named CALLBACK in RSSIMAPS.M with the given input arguments.
%
%      RSSIMAPS('Property','Value',...) creates a new RSSIMAPS or raises the
%      existing singleton*.  Starting from the left, property value pairs are
%      applied to the GUI before RSSIMaps_OpeningFcn gets called.  An
%      unrecognized property name or invalid value makes property application
%      stop.  All inputs are passed to RSSIMaps_OpeningFcn via varargin.
%
%      *See GUI Options on GUIDE's Tools menu.  Choose "GUI allows only one
%      instance to run (singleton)".
%
% See also: GUIDE, GUIDATA, GUIHANDLES

% Edit the above text to modify the response to help RSSIMaps

% Last Modified by GUIDE v2.5 17-Jul-2018 11:11:09

% Begin initialization code - DO NOT EDIT
gui_Singleton = 1;
gui_State = struct('gui_Name',       mfilename, ...
                   'gui_Singleton',  gui_Singleton, ...
                   'gui_OpeningFcn', @RSSIMaps_OpeningFcn, ...
                   'gui_OutputFcn',  @RSSIMaps_OutputFcn, ...
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

% --- Executes just before RSSIMaps is made visible.
function RSSIMaps_OpeningFcn(hObject, eventdata, handles, varargin)
% This function has no output args, see OutputFcn.
% hObject    handle to figure
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
% varargin   command line arguments to RSSIMaps (see VARARGIN)

% Choose default command line output for RSSIMaps
handles.output = hObject;

contents = cellstr(get(handles.pumFloors,'String'))
index = get(handles.pumFloors,'Value')
handles.currBuildingID = str2num(contents{index});



% Update handles structure
guidata(hObject, handles);

% This sets up the initial plot - only do when we are invisible
% so window can get raised using RSSIMaps.

% UIWAIT makes RSSIMaps wait for user response (see UIRESUME)
% uiwait(handles.figure1);


% --- Outputs from this function are returned to the command line.
function varargout = RSSIMaps_OutputFcn(hObject, eventdata, handles)
% varargout  cell array for returning output args (see VARARGOUT);
% hObject    handle to figure
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Get default command line output from handles structure
varargout{1} = handles.output;


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

set(hObject, 'String', {'1', '21', '8', '33', '2', '44', '55', '66', '77', '88','123', '10'});

% --- Executes on button press in pbLoadAPs.
function pbLoadAPs_Callback(hObject, eventdata, handles)
% hObject    handle to pbLoadAPs (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)
% --- Executes on button press in pbLoadAPs.


handles.Floor = str2num(get(handles.editFloor,'String'));
handles.Resource = str2num(get(handles.editResource,'String'));
handles.Catagory = str2num(get(handles.editCatagory,'String'));



handles.APInfo = GetMostPresentAP(handles.currBuildingID,handles.Floor,handles.Resource, handles.Catagory)

nametag = [];
for i=1:length(handles.APInfo)
    nametag{i} = [handles.APInfo(i).bssid ' - ' handles.APInfo(i).ssid];
end
set(handles.lbAPList,'String', nametag)


%handles.mapfilepath 

guidata(hObject, handles);

% --- Executes on selection change in pumFloors.
function pumFloors_Callback(hObject, eventdata, handles)
% hObject    handle to pumFloors (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: contents = get(hObject,'String') returns pumFloors contents as cell array
%        contents{get(hObject,'Value')} returns selected item from pumFloors

contents = cellstr(get(hObject,'String'))
index = get(hObject,'Value')
handles.currBuildingID = str2num(contents{index});

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

loc = []


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
handles.currAPSelected = handles.APInfo(index)
set(handles.txtBSSID,'String',  handles.currAPSelected.bssid)


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


% --- Executes on button press in bpShowMap.
function bpShowMap_Callback(hObject, eventdata, handles)
% hObject    handle to bpShowMap (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

Data = load('ICNTRANLatLon.csv');
%Data = load('IT3LatLon.csv');

Lats = Data(:,2);
Lons = Data(:,3);

%Lons = 0:1:95;
%Lats = ones(96) * 23;
HeatMap = GetRSSIMapofAP(handles.currAPSelected.bssid,handles.currBuildingID, handles.Floor, handles.Resource, handles.Catagory);

%HeatMap = GetRSSIMapofAP('F05C191F6150',handles.Floor ) ;
X = [];
Y = [];
R = [];
for i=1:length(HeatMap)
X = [X; HeatMap(i).Lon];
Y = [Y; HeatMap(i).Lat];
R = [R; HeatMap(i).RSS];
end
%mesh(X,Y,R);
%[xq,yq] = meshgrid(0:1:92, 0:1:35);

%37.4464804  37.4506429  126.4479860 126.4545972
[xq,yq] = meshgrid(37.4464804:0.0001:37.4506429,  126.4479860:0.0001:126.4545972);

%vq = griddata(X,Y,R,xq,yq);
%Plot the gridded data as a mesh and the scattered data as dots.

figure;
plot(Lons,Lats,  'x');
hold on
%Vq = interpn(vq,'cubic');
%Vq = interpn(X,Y,R,xq,yq,'linear');
%F = scatteredInterpolant(X,Y,R);
%Vq = F(xq,yq);
%mesh(xq,yq,Vq);
%surf(xq,yq,vq);
%hold on


index4140 = find(R < -21);
bx = plot3(X(index4140),Y(index4140),R(index4140),'ro');
set(bx,'MarkerFaceColor','red')

index5140 = find(R < -51);
cx = plot3(X(index5140),Y(index5140),R(index5140),'mo');
set(cx,'MarkerFaceColor','magenta')

index6140 = find(R < -61);
dx = plot3(X(index6140),Y(index6140),R(index6140),'go');
set(dx,'MarkerFaceColor','green')

index7140 = find(R < -71);
ex = plot3(X(index7140),Y(index7140),R(index7140),'bo');
set(ex,'MarkerFaceColor','blue')

index8140 = find(R < -81);
fx = plot3(X(index8140),Y(index8140),R(index8140),'yo');
set(fx,'MarkerFaceColor','yellow')

index9140 = find(R < -100);
ax = plot3(X(index9140),Y(index9140),R(index9140),'ko');
set(ax,'MarkerFaceColor','black')

legend('show')
legend('Ref Point','0 -> -40','41 -> -50','51 -> -60','61 -> -70','71 -> -80','0 -> -100') 

%colormap(ax, hot(8));
%caxis([30 100])

%h = gca;
%h.XLim = [-2.7 2.7];,'0 -> -20'
%h.YLim = [-2.7 2.7];



function editFloor_Callback(hObject, eventdata, handles)
% hObject    handle to editFloor (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: get(hObject,'String') returns contents of editFloor as text
%        str2double(get(hObject,'String')) returns contents of editFloor as a double


% --- Executes during object creation, after setting all properties.
function editFloor_CreateFcn(hObject, eventdata, handles)
% hObject    handle to editFloor (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    empty - handles not created until after all CreateFcns called

% Hint: edit controls usually have a white background on Windows.
%       See ISPC and COMPUTER.
if ispc && isequal(get(hObject,'BackgroundColor'), get(0,'defaultUicontrolBackgroundColor'))
    set(hObject,'BackgroundColor','white');
end



function editResource_Callback(hObject, eventdata, handles)
% hObject    handle to editResource (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: get(hObject,'String') returns contents of editResource as text
%        str2double(get(hObject,'String')) returns contents of editResource as a double


% --- Executes during object creation, after setting all properties.
function editResource_CreateFcn(hObject, eventdata, handles)
% hObject    handle to editResource (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    empty - handles not created until after all CreateFcns called

% Hint: edit controls usually have a white background on Windows.
%       See ISPC and COMPUTER.
if ispc && isequal(get(hObject,'BackgroundColor'), get(0,'defaultUicontrolBackgroundColor'))
    set(hObject,'BackgroundColor','white');
end



function editCatagory_Callback(hObject, eventdata, handles)
% hObject    handle to editCatagory (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    structure with handles and user data (see GUIDATA)

% Hints: get(hObject,'String') returns contents of editCatagory as text
%        str2double(get(hObject,'String')) returns contents of editCatagory as a double


% --- Executes during object creation, after setting all properties.
function editCatagory_CreateFcn(hObject, eventdata, handles)
% hObject    handle to editCatagory (see GCBO)
% eventdata  reserved - to be defined in a future version of MATLAB
% handles    empty - handles not created until after all CreateFcns called

% Hint: edit controls usually have a white background on Windows.
%       See ISPC and COMPUTER.
if ispc && isequal(get(hObject,'BackgroundColor'), get(0,'defaultUicontrolBackgroundColor'))
    set(hObject,'BackgroundColor','white');
end
