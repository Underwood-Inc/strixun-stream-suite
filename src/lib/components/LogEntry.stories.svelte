<script lang="ts" module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import LogEntry from './LogEntry.svelte';
  import type { LogEntry as LogEntryType } from '../../stores/activity-log';

  const { Story } = defineMeta({
    title: 'Components/LogEntry',
    component: LogEntry,
    tags: ['autodocs'],
  });

  const sampleEntry: LogEntryType = {
    id: '1',
    timestamp: new Date(),
    type: 'debug',
    message: 'This is a sample log entry',
    metadata: {}
  };

  const infoEntry: LogEntryType = {
    id: '2',
    timestamp: new Date(),
    type: 'info',
    message: 'Information message',
    metadata: {}
  };

  const warningEntry: LogEntryType = {
    id: '3',
    timestamp: new Date(),
    type: 'warning',
    message: 'Warning message',
    metadata: {}
  };

  const errorEntry: LogEntryType = {
    id: '4',
    timestamp: new Date(),
    type: 'error',
    message: 'Error message',
    metadata: {}
  };

  const successEntry: LogEntryType = {
    id: '5',
    timestamp: new Date(),
    type: 'success',
    message: 'Success message',
    metadata: {}
  };
</script>

<Story name="Log Type">
  <div style="padding: 20px; background: var(--bg);">
    <LogEntry entry={sampleEntry} index={0} />
  </div>
</Story>

<Story name="Info Type">
  <div style="padding: 20px; background: var(--bg);">
    <LogEntry entry={infoEntry} index={1} />
  </div>
</Story>

<Story name="Warning Type">
  <div style="padding: 20px; background: var(--bg);">
    <LogEntry entry={warningEntry} index={2} />
  </div>
</Story>

<Story name="Error Type">
  <div style="padding: 20px; background: var(--bg);">
    <LogEntry entry={errorEntry} index={3} />
  </div>
</Story>

<Story name="Success Type">
  <div style="padding: 20px; background: var(--bg);">
    <LogEntry entry={successEntry} index={4} />
  </div>
</Story>

<Story name="All Types">
  <div style="padding: 20px; background: var(--bg); display: flex; flex-direction: column; gap: 8px;">
    <LogEntry entry={sampleEntry} index={0} />
    <LogEntry entry={infoEntry} index={1} />
    <LogEntry entry={warningEntry} index={2} />
    <LogEntry entry={errorEntry} index={3} />
    <LogEntry entry={successEntry} index={4} />
  </div>
</Story>









