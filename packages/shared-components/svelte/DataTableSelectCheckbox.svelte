<script lang="ts">
  interface Props {
    checked: boolean;
    onChange: (event: Event) => void;
  }

  let { checked, onChange }: Props = $props();
</script>

<input
  type="checkbox"
  {checked}
  onchange={onChange}
  onclick={(e) => e.stopPropagation()}
  aria-label="Select row"
/>