import PropTypes from 'prop-types';
import React, { useState } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { updateProfile, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  Text,
  View,
  Image,
  Alert,
  TextInput,
  StatusBar,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';

import { colors } from '../config/constants';
import backImage from '../assets/background.png';
import { auth, database } from '../config/firebase';

export default function SignUp({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Email validation function
  const validateEmail = (emailToValidate) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailToValidate);
  };

  // Password validation function
  const validatePassword = (passwordToValidate) => {
    const hasLength = passwordToValidate.length >= 8;
    const hasCapital = /[A-Z]/.test(passwordToValidate);
    const hasNumber = /\d/.test(passwordToValidate);

    return {
      isValid: hasLength && hasCapital && hasNumber,
      errors: {
        length: !hasLength,
        capital: !hasCapital,
        number: !hasNumber,
      },
    };
  };

  // Check if email already exists
  const checkEmailExists = async (emailToCheck) => {
    try {
      const userDoc = await getDoc(doc(database, 'users', emailToCheck));
      return userDoc.exists();
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  };

  const onHandleSignup = async () => {
    // Reset errors
    setEmailError('');
    setPasswordError('');

    // Validate email format
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Check if email already exists
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      setEmailError('This email is already registered');
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      let errorMessage = 'Password must contain:';
      if (passwordValidation.errors.length) errorMessage += ' at least 8 characters,';
      if (passwordValidation.errors.capital) errorMessage += ' one capital letter,';
      if (passwordValidation.errors.number) errorMessage += ' one number';
      setPasswordError(errorMessage);
      return;
    }

    // Validate username
    if (username.trim() === '') {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    if (email !== '' && password !== '') {
      createUserWithEmailAndPassword(auth, email, password)
        .then((cred) => {
          updateProfile(cred.user, { displayName: username }).then(() => {
            setDoc(doc(database, 'users', cred.user.email), {
              id: cred.user.uid,
              email: cred.user.email,
              name: cred.user.displayName,
              about: 'Available',
            });
          });
          console.log(`Signup success: ${cred.user.email}`);
        })
        .catch((err) => Alert.alert('Signup error', err.message));
    }
  };

  return (
    <View style={styles.container}>
      <Image source={backImage} style={styles.backImage} />
      <View style={styles.whiteSheet} />
      <SafeAreaView style={styles.form}>
        <Text style={styles.title}>Sign Up</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter name"
          autoCapitalize="none"
          keyboardType="name-phone-pad"
          textContentType="name"
          autoFocus
          value={username}
          onChangeText={(text) => setUsername(text)}
        />
        <TextInput
          style={[styles.input, emailError ? styles.inputError : null]}
          placeholder="Enter email"
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setEmailError('');
          }}
        />
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        <TextInput
          style={[styles.input, passwordError ? styles.inputError : null]}
          placeholder="Enter password"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setPasswordError('');
          }}
        />
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={onHandleSignup}>
          <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 18 }}> Sign Up</Text>
        </TouchableOpacity>
        <View
          style={{ marginTop: 30, flexDirection: 'row', alignItems: 'center', alignSelf: 'center' }}
        >
          <Text style={{ color: 'gray', fontWeight: '600', fontSize: 14 }}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={{ color: colors.pink, fontWeight: '600', fontSize: 14 }}> Log In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <StatusBar barStyle="light-content" />
    </View>
  );
}
const styles = StyleSheet.create({
  backImage: {
    height: 340,
    position: 'absolute',
    resizeMode: 'cover',
    top: 0,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 58,
    justifyContent: 'center',
    marginTop: 40,
  },
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginBottom: 10,
    marginTop: -10,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 30,
  },
  input: {
    backgroundColor: '#F6F7FB',
    borderRadius: 10,
    fontSize: 16,
    height: 58,
    marginBottom: 20,
    padding: 12,
  },
  inputError: {
    borderColor: 'red',
    borderWidth: 1,
  },
  title: {
    alignSelf: 'center',
    color: 'black',
    fontSize: 36,
    fontWeight: 'bold',
    paddingTop: 48,
  },
  whiteSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 60,
    bottom: 0,
    height: '75%',
    position: 'absolute',
    width: '100%',
  },
});

SignUp.propTypes = {
  navigation: PropTypes.object,
};
