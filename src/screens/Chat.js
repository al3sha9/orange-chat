import PropTypes from 'prop-types';
import uuid from 'react-native-uuid';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import EmojiModal from 'react-native-emoji-modal';
import { Audio } from 'expo-av';
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { Send, Bubble, GiftedChat, InputToolbar } from 'react-native-gifted-chat';
import { ref, getStorage, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import {
  View,
  Text,
  Keyboard,
  StyleSheet,
  BackHandler,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { colors } from '../config/constants';
import { auth, database } from '../config/firebase';

const RenderLoadingUpload = () => (
  <View style={styles.loadingContainerUpload}>
    <ActivityIndicator size="large" color={colors.teal} />
  </View>
);

const RenderLoading = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={colors.teal} />
  </View>
);

const RenderBubble = (props) => (
  <Bubble
    {...props}
    wrapperStyle={{
      right: { backgroundColor: colors.primary },
      left: { backgroundColor: 'lightgrey' },
    }}
    renderMessageVideo={() => null}
    renderMessageAudio={(messageProps) => {
      if (messageProps.currentMessage.audio) {
        return <AudioMessage audioUrl={messageProps.currentMessage.audio} />;
      }
      return null;
    }}
  />
);

const AudioMessage = ({ audioUrl }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const playPauseAudio = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setDuration(status.durationMillis || 0);
              setPosition(status.positionMillis || 0);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
              }
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const formatTime = (millis) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.audioMessageContainer}>
      <TouchableOpacity onPress={playPauseAudio} style={styles.playButton}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={24}
          color={colors.primary}
        />
      </TouchableOpacity>
      <View style={styles.audioProgress}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: duration > 0 ? `${(position / duration) * 100}%` : '0%' },
            ]}
          />
        </View>
        <Text style={styles.audioDuration}>
          {formatTime(isPlaying ? position : duration)}
        </Text>
      </View>
    </View>
  );
};

const RenderAttach = (props, showMenu, onPress) => (
  <TouchableOpacity {...props} style={styles.addImageIcon} onPress={onPress}>
    <View>
      <Ionicons
        name={showMenu ? "close" : "attach-outline"}
        size={32}
        color={colors.teal}
      />
    </View>
  </TouchableOpacity>
);

const RenderInputToolbar = (props, handleEmojiPanel) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      backgroundColor: 'white',
    }}
  >
    <InputToolbar
      {...props}
      renderActions={() => RenderActions(handleEmojiPanel)}
      containerStyle={styles.inputToolbar}
    />
    <Send {...props}>
      <View style={styles.sendIconContainer}>
        <Ionicons name="send" size={24} color={colors.teal} />
      </View>
    </Send>
  </View>
);

const RenderActions = (handleEmojiPanel) => (
  <TouchableOpacity style={styles.emojiIcon} onPress={handleEmojiPanel}>
    <View>
      <Ionicons name="happy-outline" size={32} color={colors.teal} />
    </View>
  </TouchableOpacity>
);

const RenderAttachmentMenu = ({ visible, onClose, onImagePress, onAudioPress }) => {
  if (!visible) return null;

  return (
    <View style={styles.attachmentMenu}>
      <TouchableOpacity style={styles.attachmentOption} onPress={onImagePress}>
        <View style={styles.attachmentIconContainer}>
          <Ionicons name="image" size={24} color={colors.primary} />
        </View>
        <Text style={styles.attachmentOptionText}>Photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.attachmentOption} onPress={onAudioPress}>
        <View style={styles.attachmentIconContainer}>
          <Ionicons name="mic" size={24} color={colors.primary} />
        </View>
        <Text style={styles.attachmentOptionText}>Audio</Text>
      </TouchableOpacity>
    </View>
  );
};

const RenderRecordingIndicator = ({ isRecording, onStop }) => {
  if (!isRecording) return null;

  return (
    <View style={styles.recordingContainer}>
      <View style={styles.recordingIndicator}>
        <View style={styles.pulseDot} />
        <Text style={styles.recordingText}>Recording...</Text>
      </View>
      <TouchableOpacity style={styles.stopButton} onPress={onStop}>
        <Ionicons name="stop" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

function Chat({ route }) {
  const [messages, setMessages] = useState([]);
  const [modal, setModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(database, 'chats', route.params.id), (document) => {
      setMessages(
        document.data().messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toDate(),
          image: message.image ?? '',
        }))
      );
    });

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      //  Dismiss the keyboard
      Keyboard.dismiss();
      //  If the emoji panel is open, close it
      if (modal) {
        setModal(false);
        return true;
      }
      return false;
    });

    //  Dismiss the emoji panel when the keyboard is shown
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      if (modal) setModal(false);
    });

    // Cleanup
    return () => {
      unsubscribe();
      backHandler.remove();
      keyboardDidShowListener.remove();
    };
  }, [route.params.id, modal]);

  const onSend = useCallback(
    async (m = []) => {
      // Get messages
      const chatDocRef = doc(database, 'chats', route.params.id);
      const chatDocSnap = await getDoc(chatDocRef);

      const chatData = chatDocSnap.data();
      const data = chatData.messages.map((message) => ({
        ...message,
        createdAt: message.createdAt.toDate(),
        image: message.image ?? '',
      }));

      // Attach new message
      const messagesWillSend = [{ ...m[0], sent: true, received: false }];
      const chatMessages = GiftedChat.append(data, messagesWillSend);

      setDoc(
        doc(database, 'chats', route.params.id),
        {
          messages: chatMessages,
          lastUpdated: Date.now(),
        },
        { merge: true }
      );
    },
    [route.params.id]
  );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      await uploadImageAsync(result.assets[0].uri);
    }
  };

  const uploadImageAsync = async (uri) => {
    setUploading(true);
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });

    const randomString = uuid.v4();
    const fileRef = ref(getStorage(), randomString);
    const uploadTask = uploadBytesResumable(fileRef, blob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`Upload is ${progress}% done`);
      },
      (error) => {
        // Handle unsuccessful uploads
        console.log(error);
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        setUploading(false);
        onSend([
          {
            _id: randomString,
            createdAt: new Date(),
            text: '',
            image: downloadUrl,
            user: {
              _id: auth?.currentUser?.email,
              name: auth?.currentUser?.displayName,
              avatar: 'https://i.pravatar.cc/300',
            },
          },
        ]);
      }
    );
  };

  const startRecording = async () => {
    try {
      console.log('Requesting permissions..');
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    console.log('Stopping recording..');
    setIsRecording(false);
    if (!recording) return;

    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    const uri = recording.getURI();
    setRecording(null);
    console.log('Recording stopped and stored at', uri);

    if (uri) {
      await uploadAudioAsync(uri);
    }
  };

  const uploadAudioAsync = async (uri) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const randomString = uuid.v4();
      const fileRef = ref(getStorage(), `audio/${randomString}.m4a`);
      const uploadTask = uploadBytesResumable(fileRef, blob);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Audio upload is ${progress}% done`);
        },
        (error) => {
          console.log('Audio upload error:', error);
          setUploading(false);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setUploading(false);
          onSend([
            {
              _id: randomString,
              createdAt: new Date(),
              text: '',
              audio: downloadUrl,
              user: {
                _id: auth?.currentUser?.email,
                name: auth?.currentUser?.displayName,
                avatar: 'https://i.pravatar.cc/300',
              },
            },
          ]);
        }
      );
    } catch (error) {
      console.error('Error uploading audio:', error);
      setUploading(false);
    }
  };

  const handleAttachPress = () => {
    setShowAttachMenu(!showAttachMenu);
  };

  const handleEmojiPanel = useCallback(() => {
    setModal((prevModal) => {
      if (prevModal) {
        // If the modal is already open, close it
        Keyboard.dismiss();
        return false;
      }
      // If the modal is closed, open it
      Keyboard.dismiss();
      return true;
    });
  }, []);

  return (
    <>
      {uploading && RenderLoadingUpload()}
      <RenderRecordingIndicator isRecording={isRecording} onStop={stopRecording} />
      <GiftedChat
        messages={messages}
        showAvatarForEveryMessage={false}
        showUserAvatar={false}
        onSend={(messagesArr) => onSend(messagesArr)}
        imageStyle={{ height: 212, width: 212 }}
        messagesContainerStyle={{ backgroundColor: '#fff', paddingBottom: showAttachMenu ? 140 : 80 }}
        textInputStyle={{ backgroundColor: '#fff', borderRadius: 20 }}
        user={{
          _id: auth?.currentUser?.email,
          name: auth?.currentUser?.displayName,
          avatar: 'https://i.pravatar.cc/300',
        }}
        renderBubble={(props) => RenderBubble(props)}
        renderSend={(props) => RenderAttach(props, showAttachMenu, handleAttachPress)}
        renderUsernameOnMessage
        renderAvatarOnTop
        renderInputToolbar={(props) => RenderInputToolbar(props, handleEmojiPanel)}
        minInputToolbarHeight={56}
        scrollToBottom
        onPressActionButton={handleEmojiPanel}
        scrollToBottomStyle={styles.scrollToBottomStyle}
        renderLoading={RenderLoading}
      />

      <RenderAttachmentMenu
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        onImagePress={() => {
          setShowAttachMenu(false);
          pickImage();
        }}
        onAudioPress={() => {
          setShowAttachMenu(false);
          startRecording();
        }}
      />

      {modal && (
        <EmojiModal
          onPressOutside={handleEmojiPanel}
          modalStyle={styles.emojiModal}
          containerStyle={styles.emojiContainerModal}
          backgroundStyle={styles.emojiBackgroundModal}
          columns={5}
          emojiSize={66}
          activeShortcutColor={colors.primary}
          onEmojiSelected={(emoji) => {
            onSend([
              {
                _id: uuid.v4(),
                createdAt: new Date(),
                text: emoji,
                user: {
                  _id: auth?.currentUser?.email,
                  name: auth?.currentUser?.displayName,
                  avatar: 'https://i.pravatar.cc/300',
                },
              },
            ]);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  addImageIcon: {
    borderRadius: 16,
    bottom: 8,
    height: 32,
    width: 32,
  },
  emojiBackgroundModal: {},
  emojiContainerModal: {
    height: 348,
    width: 396,
  },
  emojiIcon: {
    borderRadius: 16,
    bottom: 8,
    height: 32,
    marginLeft: 4,
    width: 32,
  },
  emojiModal: {},
  inputToolbar: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderColor: colors.grey,
    borderRadius: 22,
    borderWidth: 0.5,
    flex: 1,
    flexDirection: 'row',
    marginBottom: 50,
    marginHorizontal: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingContainerUpload: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 999,
  },
  scrollToBottomStyle: {
    borderColor: colors.grey,
    borderRadius: 28,
    borderWidth: 1,
    bottom: 12,
    height: 56,
    position: 'absolute',
    right: 12,
    width: 56,
  },
  sendIconContainer: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderColor: colors.grey,
    borderRadius: 22,
    borderWidth: 0.5,
    height: 44,
    justifyContent: 'center',
    marginBottom: 30,
    marginRight: 8,
    width: 44,
  },
  attachmentMenu: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  attachmentOption: {
    alignItems: 'center',
    padding: 16,
  },
  attachmentIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  attachmentOptionText: {
    fontSize: 12,
    color: colors.grey,
    fontWeight: '500',
  },
  recordingContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: 25,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 8,
  },
  recordingText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    minWidth: 200,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  audioProgress: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  audioDuration: {
    fontSize: 12,
    color: colors.grey,
  },
});

Chat.propTypes = {
  route: PropTypes.object.isRequired,
};

export default Chat;
