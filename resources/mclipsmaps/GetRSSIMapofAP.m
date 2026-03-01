function [HeatMap] = GetRSSIMapofAP(bssid, building_id, floor, RType, CType)
% Add jar file to classpath (ensure it is present in your current dir)
javaclasspath('postgresql-42.1.4.jre7.jar');

% Username and password you chose when installing postgres
props=java.util.Properties;
props.setProperty('user', 'postgres');
props.setProperty('password', 'mcl3523');

% Create the database connection (port 5432 is the default postgres chooses
% on installation)
driver=org.postgresql.Driver;
%url = 'jdbc:postgresql://165.229.187.234:5432/PCO';

url = 'jdbc:postgresql://localhost:5432/PCO';
conn=driver.connect(url, props);

% A test query
%sql='select DISTINCT("bssid") from "wifi_fpdb".wifi_fp where "SSID" like ''%%iPhone%%'''; % Gets all records
%sql='select DISTINCT("bssid") from "wifi_fpdb".wifi_fp'; % Gets all records
%sql='Delete from "wifi_fpdb".wifi_fp where "SSID" like ''%%Egg%%'''; % Gets all records

%strWhere = sprintf('"bssid" = ''%s'' AND "floor" = %d ', bssid,floor);
strWhere = sprintf('"bssid" = ''%s'' AND "building_id" = %d AND "floor" = %d',bssid, building_id, floor);

if  RType > -1 && CType > -1
    strWhere = sprintf('"bssid" = ''%s'' AND "building_id" = %d AND "floor" = %d AND "resource_type" = %d AND "collecting_type" = %d',bssid, building_id,floor, RType, CType);
elseif RType > -1
    strWhere = sprintf('"bssid" = ''%s'' AND "building_id" = %d AND "floor" = %d AND "resource_type" = %d',bssid, building_id,floor, RType);
end



sql = ['SELECT floor(avg("rssi")), "longitude", "latitude", "altitude" FROM "wifi_fpdb".wifi_raw WHERE ' strWhere  ' Group by  "longitude", "latitude", "altitude";'];
         

%strWhere = sprintf('"bssid" = ''%s'' AND "floor" = %d AND "Latitude"= 21 ', bssid,floor);

ps=conn.prepareStatement(sql);
rs=ps.executeQuery();
HeatMap = struct;1
% Read the results into an array of result structs
count=0;
while rs.next()
    count=count+1;    
    HeatMap(count).RSS = rs.getInt(1);
    HeatMap(count).Lon = rs.getDouble(2);
    HeatMap(count).Lat = rs.getDouble(3);
    HeatMap(count).Alt = rs.getDouble(4);

    
    %result(count).var1=char(rs.getString(2));
    %result(count).var2=char(rs.getString(3));
end

conn.close()
count