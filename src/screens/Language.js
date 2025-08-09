import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  Text,
  View,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { colors } from '../config/constants';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: '中文 (Chinese)', flag: '🇨🇳' },
  { code: 'es', name: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'hi', name: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'ar', name: 'العربية (Arabic)', flag: '🇸🇦' },
  { code: 'pt', name: 'Português (Portuguese)', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский (Russian)', flag: '🇷🇺' },
  { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵' },
  { code: 'fr', name: 'Français (French)', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch (German)', flag: '🇩🇪' },
  { code: 'ko', name: '한국어 (Korean)', flag: '🇰🇷' },
  { code: 'it', name: 'Italiano (Italian)', flag: '🇮🇹' },
];

const Language = ({ navigation }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  useEffect(() => {
    loadSelectedLanguage();
  }, []);

  const loadSelectedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('selectedLanguage');
      if (savedLanguage) {
        setSelectedLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const saveLanguage = async (languageCode) => {
    try {
      await AsyncStorage.setItem('selectedLanguage', languageCode);
      setSelectedLanguage(languageCode);
      
      const selectedLang = LANGUAGES.find(lang => lang.code === languageCode);
      Alert.alert(
        'Language Changed',
        `Language has been set to ${selectedLang.name}. Some changes may require app restart.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving language:', error);
      Alert.alert('Error', 'Failed to save language preference');
    }
  };

  const renderLanguageOption = (language) => (
    <TouchableOpacity
      key={language.code}
      style={[
        styles.languageOption,
        selectedLanguage === language.code && styles.selectedOption
      ]}
      onPress={() => saveLanguage(language.code)}
    >
      <View style={styles.languageInfo}>
        <Text style={styles.flag}>{language.flag}</Text>
        <Text style={[
          styles.languageName,
          selectedLanguage === language.code && styles.selectedText
        ]}>
          {language.name}
        </Text>
      </View>
      {selectedLanguage === language.code && (
        <Ionicons name="checkmark" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.header}>Choose your language</Text>
        <Text style={styles.subtitle}>
          Select your preferred language for the app interface
        </Text>
        
        <View style={styles.languageList}>
          {LANGUAGES.map(renderLanguageOption)}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.grey,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  languageList: {
    paddingHorizontal: 16,
  },
  languageOption: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedOption: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#fff5f0',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  selectedText: {
    color: colors.primary,
    fontWeight: '600',
  },
});

Language.propTypes = {
  navigation: PropTypes.object.isRequired,
};

export default Language;
