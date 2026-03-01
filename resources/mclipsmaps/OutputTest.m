function OutputTest(BuildingName, Lats0, Lons0, Lats, Lons, FloorErr, ShowCDF, ShowGT)

Walk = 0;
% OverAll = 0;



%data = jsondecode(str)

%[C, ia, ic] = unique(DataX(:,2))
%DataX = DataX(ia,:);


%figure;
%[outlineLat, outlineLon] = outlinegeoquad(latlim, lonlim, 90, 5);
%geoshow(outlineLat,outlineLon,'DisplayType','line','Color','black') 

%Index = find(DataX(:,8)==1);
%DataX = DataX(Index,:);   % sort the whole matrix using the sort indices

% [~,idx] = sort(DataX(:,1)); % sort just the first column
% Data = DataX(idx,:);   % sort the whole matrix using the sort indices

% figure;
% plot(Data(:,7))
% figure;
% %Index = find(Data(:,2)>36.38010);
% %Data = Data(1:100,:);
% Lats0 = Data(:,2);
% Lons0 = Data(:,3);
% Lats = Data(:,4);
% Lons = Data(:,5);
% FloorErr = Data(:,6);
% Alt0 = Data(:,7);
% Alts = Data(:,8);



UD = []
D = []
for i=1:length(Lats0)
   [arclen, az] = distance(Lats0(i),Lons0(i), Lats(i),Lons(i)); 
   %sqrt(sum((G - G2) .^ 2))
   arclen2 = sqrt((Lats0(i)-Lats(i))^2 + (Lons0(i)-Lons(i))^2);
    if Walk == 0    
        x = [Lats0 Lats];
        y = [Lons0 Lons];
        %geoshow(x,y,'DisplayType','Line');
        hold on
    end
    UD = [UD arclen2];
    D = [D deg2km(arclen) * 1000];
end

%D = UD;
ShowOUTPUT = 0
if ShowOUTPUT == 1
    figure;
    %geoshow(VarName1,VarName2,'DisplayType','Point')
    geoshow(Lats,Lons,'DisplayType','Point')
    hold on

    if Walk == 1
         geoshow(Lats,Lons,'DisplayType','Line');
    end


    hold on;
    %figure;
    %geoshow(VarName1,VarName2,'DisplayType','Point')
    hold on
    geoshow(Lats,Lons,'DisplayType','Point')
    title([BuildingName ' - indoor, RP Count: ' num2str(length(D))])

end

if ShowCDF == 1
    figure;
    [f,x] = ecdf(D)
    fs = smooth(x)
    fg = smooth(f)
    plot(fs,fg,'Marker','*','MarkerIndices',1:10:length(x));
    legend('mClips')
    title([BuildingName ' - Avg: ' num2str(mean(D)) ', Std: ' num2str(std(D)) ', RP Count: ' num2str(length(D))])
    xlabel('error distance(m)')
    ylabel('CDF')
    [BuildingName ' - Avg: ' num2str(mean(D)) ', Std: ' num2str(std(D)) ', RP Count: ' num2str(length(D))]
    grid on
end

if ShowGT == 1
    figure;
    plot(Lons0,Lats0,'r*');
    hold on;
    plot(Lons,Lats,'go');
    hold on;
    for i=1:length(Lats0)
    line([Lons0(i) Lons(i)],[Lats0(i) Lats(i)]);
    hold on;
    end
    legend('Ground Truth','Est. Point','Error Line')
    ylabel('Latitude')
    xlabel('Longitude')
    title([BuildingName ', RP Count: ' num2str(length(D))])
    
end
%axis([-2.2 59 -2.0 22])

% axis([0 59 0 21])
% 
% 
% %axis tight; 
% hold on
% I = imread('ITPixelMap.bmp'); 
% h = image(xlim,ylim,I); 
% uistack(h,'bottom')
% grid on
% hold off;

% figure;
% 
% plot(Lats0,Alt0,'r*');
% hold on;
% plot(Lats0,Alts,'go');
% hold on;
% for i=1:length(Lats0)
% line([Lats0(i) Lats0(i)],[Alt0(i) Alts(i)]);
% hold on;
% end
% 
% legend('Ground Truth','Est. Point','Error Line')
% xlabel('Latitude')
% ylabel('Floor No.')

