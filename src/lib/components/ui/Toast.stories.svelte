<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import Toast from './Toast.svelte';
  import type { Toast as ToastType } from '../../../stores/toast-queue';

  const { Story } = defineMeta({
    title: 'Components/Toast',
    component: Toast,
    tags: ['autodocs'],
  });

  const successToast: ToastType = {
    id: '1',
    message: 'Operation completed successfully',
    type: 'success',
    duration: 5000,
    persistent: false
  };

  const errorToast: ToastType = {
    id: '2',
    message: 'An error occurred',
    type: 'error',
    duration: 5000,
    persistent: false
  };

  const warningToast: ToastType = {
    id: '3',
    message: 'Warning: Please check your settings',
    type: 'warning',
    duration: 5000,
    persistent: false
  };

  const infoToast: ToastType = {
    id: '4',
    message: 'Information: This is an info message',
    type: 'info',
    duration: 5000,
    persistent: false
  };

  const persistentToast: ToastType = {
    id: '5',
    message: 'This toast will not auto-dismiss',
    type: 'info',
    duration: 0,
    persistent: true
  };

  function handleDismiss(id: string) {
    console.log('Dismissed toast:', id);
  }
</script>

<Story name="Success">
  <div style="padding: 20px;">
    <Toast toast={successToast} onDismiss={handleDismiss} index={0} />
  </div>
</Story>

<Story name="Error">
  <div style="padding: 20px;">
    <Toast toast={errorToast} onDismiss={handleDismiss} index={1} />
  </div>
</Story>

<Story name="Warning">
  <div style="padding: 20px;">
    <Toast toast={warningToast} onDismiss={handleDismiss} index={2} />
  </div>
</Story>

<Story name="Info">
  <div style="padding: 20px;">
    <Toast toast={infoToast} onDismiss={handleDismiss} index={3} />
  </div>
</Story>

<Story name="Persistent">
  <div style="padding: 20px;">
    <Toast toast={persistentToast} onDismiss={handleDismiss} index={4} />
  </div>
</Story>

<Story name="All Types">
  <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
    <Toast toast={successToast} onDismiss={handleDismiss} index={0} />
    <Toast toast={errorToast} onDismiss={handleDismiss} index={1} />
    <Toast toast={warningToast} onDismiss={handleDismiss} index={2} />
    <Toast toast={infoToast} onDismiss={handleDismiss} index={3} />
  </div>
</Story>


