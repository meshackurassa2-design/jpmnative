// app/(settings)/verification.tsx
import { useTheme } from '../../lib/theme';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export default function VerificationScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();
  const supabase = createClient();
  
  const [fullName, setFullName] = useState('');
  const [knownAs, setKnownAs] = useState('');
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState(false);

  const pickDocument = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setDocumentUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!fullName.trim() || !knownAs.trim() || !category.trim() || !reason.trim() || !documentUri) {
      Alert.alert('Missing Information', 'Please fill out all fields and attach a Government ID.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Upload ID to Supabase Storage (using post_images bucket for simplicity)
      const base64 = await FileSystem.readAsStringAsync(documentUri, { encoding: 'base64' });
      const fileExt = documentUri.split('.').pop() || 'jpeg';
      const filePath = `verifications/${user.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('post_images')
        .upload(filePath, decode(base64), { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('post_images').getPublicUrl(filePath);
      const document_url = publicUrlData.publicUrl;

      // 2. Insert Request
      const { error } = await supabase.from('verification_requests').insert({
        user_id: user.id,
        reason: reason.trim(),
        full_name: fullName.trim(),
        known_as: knownAs.trim(),
        category: category.trim(),
        document_url: document_url
      });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already Pending', 'You already have a pending verification request. Please wait for the admin to review it.');
        } else {
          throw error;
        }
      } else {
        Alert.alert('Success', 'Your verification request has been submitted successfully!');
        router.back();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={60} color="#3b82f6" />
          <Text style={styles.title}>Apply for Instagram Verification</Text>
          <Text style={styles.subtitle}>
            Verified accounts have blue checkmarks next to their names to show that they are the authentic presence of the public figures, celebrities, and brands they represent.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Step 1: Confirm Authenticity</Text>
          
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your legal name"
            placeholderTextColor="#a1a1aa"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>Document Type (Upload ID)</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument} activeOpacity={0.8}>
            {documentUri ? (
              <Image source={{ uri: documentUri }} style={styles.documentPreview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="cloud-upload-outline" size={32} color="#a1a1aa" />
                <Text style={styles.uploadText}>Tap to select Government ID</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Step 2: Confirm Notability</Text>

          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. News/Media, Sports, Music, Creator"
            placeholderTextColor="#a1a1aa"
            value={category}
            onChangeText={setCategory}
          />

          <Text style={styles.label}>Known As</Text>
          <TextInput
            style={styles.input}
            placeholder="Your stage name or alias"
            placeholderTextColor="#a1a1aa"
            value={knownAs}
            onChangeText={setKnownAs}
          />

          <Text style={styles.label}>Why should you be verified?</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about your audience and impact..."
            placeholderTextColor="#a1a1aa"
            value={reason}
            onChangeText={setReason}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]} 
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 20, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textDim, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
  formCard: { backgroundColor: '#111', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#222' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textDim, marginBottom: 8 },
  input: { backgroundColor: '#000', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#333', marginBottom: 16 },
  textArea: { height: 100 },
  uploadBtn: { backgroundColor: '#000', borderRadius: 12, borderWidth: 1, borderColor: '#333', overflow: 'hidden', marginBottom: 16, borderStyle: 'dashed' },
  uploadPlaceholder: { height: 120, justifyContent: 'center', alignItems: 'center', padding: 20 },
  uploadText: { color: '#a1a1aa', fontSize: 14, marginTop: 8, fontWeight: '500' },
  documentPreview: { width: '100%', height: 200, resizeMode: 'cover' },
  submitBtn: { backgroundColor: '#3b82f6', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' }
});
