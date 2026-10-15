import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, AppState, Linking } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { analyzeFoodPhoto } from '../services/foodRecognitionService';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

export default function CameraScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [analyzing, setAnalyzing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [isAppActive, setIsAppActive] = useState(true);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setIsAppActive(nextAppState === 'active');
    });

    return () => {
      subscription.remove();
    };
  }, [isFocused]);

  // Auto-request permission if undetermined when screen is focused
  useEffect(() => {
    if (isFocused && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [isFocused, permission?.granted, permission?.canAskAgain]);


  if (!permission) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  if (!permission.granted) {
    // If we can still ask (undetermined), we are auto-requesting in useEffect
    // So we show a loading state or nothing to avoid the "gate" UI
    if (permission.canAskAgain) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }

    // Only show the settings instructions if they have explicitly denied it
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera access is required to scan food photos.</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { marginTop: 12, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#6366f1' }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.buttonText, { color: '#6366f1' }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (cameraRef.current && !analyzing) {
      try {
        setAnalyzing(true);
        // OPTIMIZATION: Reduced quality from 1.0 to 0.6 (saves ~1s, still good quality)
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.6,
        });

        if (!photo) {
          throw new Error('No photo captured');
        }

        console.log('📸 Photo captured, analyzing...');
        await analyzePhoto(photo.uri);
      } catch (error: any) {
        setAnalyzing(false);
        console.error('Camera error:', error);
        Alert.alert('Error', error.message || 'Failed to take photo. Please try again.', [{ text: 'OK' }]);
      }
    }
  };

  // Pick an existing photo (e.g. one taken earlier at the table) and analyze it
  const pickFromLibrary = async () => {
    if (analyzing) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (picked.canceled || !picked.assets?.length) return;
    setAnalyzing(true);
    await analyzePhoto(picked.assets[0].uri);
  };

  const analyzePhoto = async (uri: string) => {
      try {
        let result;
        try {
          result = await analyzeFoodPhoto(uri);
        } catch (apiError: any) {
          if (apiError.message.includes('API Key is missing')) {
            console.log('⚠️ API Key missing - user needs to check EAS secrets');
            throw apiError; // Don't fallback to mock in production builds if it's an environment issue
          } else {
            throw apiError;
          }
        }

        setAnalyzing(false);

        if (result.success && result.foods.length > 0) {
          // Navigate to results screen
          navigation.navigate('FoodResults' as never, { result, logType: 'photo' } as never);
        } else {
          Alert.alert(
            'No Food Detected',
            result.error || 'Could not identify any food in this photo. Try taking another photo with better lighting.',
            [
              { text: 'Try Again', style: 'default' }
            ]
          );
        }

      } catch (error: any) {
        setAnalyzing(false);
        console.error('Camera error:', error);
        Alert.alert(
          'Error',
          error.message || 'Failed to analyze photo. Please try again.',
          [{ text: 'OK' }]
        );
      }
  };

  return (
    <View style={styles.container}>
      {isFocused && isAppActive && (
        <>
          <CameraView style={styles.camera} facing={facing} ref={cameraRef} />

          {/* Header with Back Button */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Take Photo</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Instructions or Analyzing Overlay */}
          {analyzing ? (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={styles.analyzingText}>Analyzing food...</Text>
              <Text style={styles.analyzingSubtext}>⚡ Optimized for speed</Text>
            </View>
          ) : (
            <View style={styles.instructionsContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="camera" size={24} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.instructionsText}>
                  Position food in frame
                </Text>
              </View>
              <Text style={styles.instructionsSubtext}>
                AI will identify and calculate calories
              </Text>
            </View>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.flipButton}
              onPress={toggleCameraFacing}
              disabled={analyzing}
            >
              <Ionicons name="camera-reverse" size={28} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureButton, analyzing && styles.buttonDisabled]}
              onPress={takePicture}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator size="large" color="#6366F1" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="camera-pick-library"
              accessibilityLabel="Choose from library"
              style={styles.flipButton}
              onPress={pickFromLibrary}
              disabled={analyzing}
            >
              <Ionicons name="images" size={26} color="#FFF" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: '#FFF',
    fontSize: 16,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  placeholder: {
    width: 60,
  },
  instructionsContainer: {
    position: 'absolute',
    top: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructionsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  instructionsSubtext: {
    fontSize: 14,
    color: '#FFF',
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 16,
  },
  analyzingSubtext: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 8,
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  controls: {
    position: 'absolute',
    bottom: 100, // Adjusted to make room for ad
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  flipButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#6366F1',
  },
  button: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
