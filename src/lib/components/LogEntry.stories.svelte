<script module>
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
    timestamp: Date.now(),
    type: 'log',
    message: 'This is a sample log entry',
    source: 'test',
    metadata: {}
  };

  const infoEntry: LogEntryType = {
    id: '2',
    timestamp: Date.now(),
    type: 'info',
    message: 'Information message',
    source: 'test',
    metadata: {}
  };

  const warningEntry: LogEntryType = {
    id: '3',
    timestamp: Date.now(),
    type: 'warning',
    message: 'Warning message',
    source: 'test',
    metadata: {}
  };

  const errorEntry: LogEntryType = {
    id: '4',
    timestamp: Date.now(),
    type: 'error',
    message: 'Error message',
    source: 'test',
    metadata: {}
  };

  const successEntry: LogEntryType = {
    id: '5',
    timestamp: Date.now(),
    type: 'success',
    message: 'Success message',
    source: 'test',
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


