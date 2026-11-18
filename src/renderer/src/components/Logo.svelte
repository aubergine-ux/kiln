<script lang="ts">
  import logo from '../../../../resources/icon.svg?url'

  let { size = 30 }: { size?: number } = $props()
</script>

<img src={logo} width={size} height={size} alt="Kiln" draggable="false" />

<style>
  img {
    display: block;
    filter: drop-shadow(0 2px 6px rgb(229 96 47 / 0.3));
  }
</style>
