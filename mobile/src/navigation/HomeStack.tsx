import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../views/home/HomeScreen';
import RouteDetailsScreen from '../views/home/RouteDetailsScreen';
import ActiveRouteScreen from '../views/home/ActiveRouteScreen';
import RouteSummaryScreen from '../views/home/RouteSummaryScreen';
import POIDetailScreen from '../views/shared/POIDetailScreen';
import RatePOIScreen from '../views/shared/RatePOIScreen';
import { RouteDetail } from '../services/routeService';
import { CompletionData } from '../viewmodels/useActiveRouteViewModel';

export type HomeStackParamList = {
  HomeMain: undefined;
  RouteDetails: { routeId: number };
  ActiveRoute: { route: RouteDetail };
  RouteSummary: { completionData: CompletionData };
  POIDetail: { poiId: number };
  RatePOI: { poiId: number; poiName: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

function HomeStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="RouteDetails" component={RouteDetailsScreen} />
      <Stack.Screen name="ActiveRoute" component={ActiveRouteScreen} />
      <Stack.Screen name="RouteSummary" component={RouteSummaryScreen} />
      <Stack.Screen name="POIDetail" component={POIDetailScreen} />
      <Stack.Screen
        name="RatePOI"
        component={RatePOIScreen}
        options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

export default HomeStack;
