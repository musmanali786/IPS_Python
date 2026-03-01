function [result] = GetMostPresentAP(building_id, floor, RType, CType)
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


strWhere = sprintf(' "building_id" = %d AND "floor" = %d', building_id, floor);

if  RType > -1 && CType > -1
    strWhere = sprintf(' "building_id" = %d AND "floor" = %d AND "resource_type" = %d AND "collecting_type" = %d',building_id,floor, RType, CType);
elseif RType > -1
    strWhere = sprintf(' "building_id" = %d AND "floor" = %d AND "resource_type" = %d',building_id, floor, RType);
end

%sql = ['SELECT DISTINCT("BSSID"), "SSID" FROM "WIFI_FPDB".wifi_raw WHERE ' strWhere];
         
sql = ['SELECT "bssid", Count(*) as A FROM "wifi_fpdb".wifi_raw WHERE ' strWhere ' Group By "bssid" Order By A DESC'];
         


ps=conn.prepareStatement(sql);
rs=ps.executeQuery();
result = struct;
% Read the results into an array of result structs
count=0;
while rs.next()
    count=count+1;
    result(count).bssid=char(rs.getString(1));
    result(count).ssid=char(rs.getString(2));
end
conn.close()

count