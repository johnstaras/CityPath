import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileSetupScreen from '../views/onboarding/ProfileSetupScreen';

type OnboardingStackParamList = {
  ProfileSetup: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

function OnboardingStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}

export default OnboardingStack;
