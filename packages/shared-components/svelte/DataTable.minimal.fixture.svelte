<script lang="ts">
  import { createTable, FlexRender, tableFeatures, type ColumnDef } from '@tanstack/svelte-table';

  type Row = { id: string; label: string };

  const data: Row[] = [{ id: 'a', label: 'Row Alpha' }];

  const features = tableFeatures({});

  const columns: ColumnDef<typeof features, Row>[] = [
    { accessorKey: 'label', header: 'Label' },
  ];

  const table = createTable({
    features,
    columns,
    data,
  });
</script>

<table>
  <thead>
    {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
      <tr>
        {#each headerGroup.headers as header (header.id)}
          <th><FlexRender {header} /></th>
        {/each}
      </tr>
    {/each}
  </thead>
  <tbody>
    {#each table.getRowModel().rows as row (row.id)}
      <tr>
        {#each row.getAllCells() as cell (cell.id)}
          <td><FlexRender {cell} /></td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>