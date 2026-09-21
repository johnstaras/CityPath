import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileStatsScreen from '../views/profile/ProfileStatsScreen';
import EditProfileScreen from '../views/profile/EditProfileScreen';
import SettingsScreen from '../views/profile/SettingsScreen';

export type ProfileStackParamList = {
  ProfileStats: undefined;
  EditProfile: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileStats" component={ProfileStatsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

export default ProfileStack;
