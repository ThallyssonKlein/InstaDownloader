import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { HIKER_API_KEY } from '@env';

import { fetchMedia, type FetchResult } from './src/api';
import { ensureGalleryPermission, saveToGallery } from './src/download';

type Status =
  | { kind: 'idle' }
  | { kind: 'fetching' }
  | { kind: 'saving'; done: number; total: number }
  | { kind: 'done'; count: number }
  | { kind: 'error'; message: string };

export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}

function Home() {
  const insets = useSafeAreaInsets();
  const [link, setLink] = useState('');
  const [result, setResult] = useState<FetchResult | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const busy = status.kind === 'fetching' || status.kind === 'saving';

  async function paste() {
    const text = await Clipboard.getString();
    if (text) setLink(text.trim());
  }

  async function search() {
    if (!link.trim()) return;
    setResult(null);
    setStatus({ kind: 'fetching' });
    try {
      setResult(await fetchMedia(link, HIKER_API_KEY));
      setStatus({ kind: 'idle' });
    } catch (e: any) {
      setStatus({ kind: 'error', message: e?.message ?? String(e) });
    }
  }

  async function download() {
    if (!result) return;
    if (!(await ensureGalleryPermission())) {
      Alert.alert(
        'Permissão negada',
        'Autorize o acesso à galeria para salvar os arquivos.',
      );
      return;
    }
    setStatus({ kind: 'saving', done: 0, total: result.items.length });
    try {
      const count = await saveToGallery(result, (done, total) =>
        setStatus({ kind: 'saving', done, total }),
      );
      setStatus({ kind: 'done', count });
    } catch (e: any) {
      setStatus({ kind: 'error', message: e?.message ?? String(e) });
    }
  }

  const videos = result?.items.filter(i => i.type === 'video').length ?? 0;
  const images = (result?.items.length ?? 0) - videos;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>InstaDownloader</Text>

        <Text style={styles.subtitle}>
          Cole o link de um post, reel, carrossel ou story.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="https://www.instagram.com/reel/..."
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="search"
          onSubmitEditing={search}
          editable={!busy}
        />

        <View style={styles.row}>
          <Button
            label="Colar"
            onPress={paste}
            variant="secondary"
            disabled={busy}
          />
          <Button
            label="Buscar"
            onPress={search}
            disabled={busy || !link.trim()}
          />
        </View>

        {status.kind === 'fetching' && (
          <ActivityIndicator style={styles.spacer} />
        )}

        {status.kind === 'error' && (
          <Text style={styles.error}>{status.message}</Text>
        )}

        {result && (
          <View style={styles.card}>
            {result.thumbnailUrl && (
              <Image
                source={{ uri: result.thumbnailUrl }}
                style={styles.thumb}
                resizeMode="cover"
              />
            )}
            <Text style={styles.meta}>
              {[
                videos && `${videos} vídeo(s)`,
                images && `${images} imagem(ns)`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {result.caption ? (
              <Text style={styles.caption} numberOfLines={4}>
                {result.caption}
              </Text>
            ) : null}

            <Button
              label={
                status.kind === 'saving'
                  ? `Salvando ${status.done}/${status.total}...`
                  : 'Baixar para a galeria'
              }
              onPress={download}
              disabled={busy}
            />
            {status.kind === 'done' && (
              <Text style={styles.success}>
                {status.count} arquivo(s) salvo(s) na galeria ✓
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.7 },
      ]}
    >
      <Text style={[styles.buttonText, !primary && { color: '#111' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 15, color: '#666' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: '#d62976' },
  buttonSecondary: { backgroundColor: '#eee' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  spacer: { marginTop: 12 },
  error: { color: '#c62828', fontSize: 15 },
  success: { color: '#2e7d32', fontSize: 15, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  thumb: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  meta: { fontWeight: '600', color: '#111' },
  caption: { color: '#444' },
});
