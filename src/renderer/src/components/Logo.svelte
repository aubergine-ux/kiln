<script lang="ts">
  import logo from '../../../../resources/icon.svg?url'

  let { size = 30 }: { size?: number } = $props()
</script>

<img src={logo} width={size} height={size} alt="Kiln" draggable="false" />

<style>
  img {
    display: block;
  }
</style>
