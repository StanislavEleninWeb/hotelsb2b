import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParamList } from './lib/types';
import { SearchScreen } from './screens/SearchScreen';
import { PropertyScreen } from './screens/PropertyScreen';
import { BookScreen } from './screens/BookScreen';
import { AccountScreen } from './screens/AccountScreen';
import { LoginScreen } from './screens/LoginScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Search">
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Harbor Stays' }} />
            <Stack.Screen name="Property" component={PropertyScreen} options={{ title: 'Property' }} />
            <Stack.Screen name="Book" component={BookScreen} options={{ title: 'Book' }} />
            <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'My bookings' }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
