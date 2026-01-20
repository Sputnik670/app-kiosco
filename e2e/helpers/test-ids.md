# Data Test IDs Recomendados

Para facilitar los tests E2E, estos son los `data-testid` que deberían agregarse a los componentes:

## Componentes de QR Scanner

### `components/qr-fichaje-scanner.tsx`
```tsx
<Dialog data-testid="qr-scanner-dialog">
  <video data-testid="qr-scanner-video" />
  <Button data-testid="qr-scanner-close">Cancelar</Button>
</Dialog>
```

### `components/generar-qr-fichaje.tsx`
```tsx
<Button data-testid="generar-qr-entrada">Generar QR Entrada</Button>
<Button data-testid="generar-qr-salida">Generar QR Salida</Button>
<Button data-testid="guardar-qr">Guardar QR</Button>
```

### `components/vista-empleado.tsx`
```tsx
<Button data-testid="escanear-qr-button">Escanear QR</Button>
```

### `app/fichaje/page.tsx`
```tsx
<div data-testid="fichaje-page">
  <div data-testid="fichaje-success">Fichaje registrado</div>
  <div data-testid="fichaje-error">Error en fichaje</div>
</div>
```

## Componentes de Autenticación

### `app/page.tsx`
```tsx
<input data-testid="email-input" />
<input data-testid="password-input" />
<Button data-testid="login-submit">Iniciar Sesión</Button>
```

## Componentes de Ventas

### `components/caja-ventas.tsx`
```tsx
<Button data-testid="abrir-caja">Abrir Caja</Button>
<Button data-testid="cerrar-caja">Cerrar Caja</Button>
<input data-testid="product-search" />
```

## Componentes de Productos

### `components/crear-producto.tsx`
```tsx
<input data-testid="product-name" />
<input data-testid="product-price" />
<input data-testid="product-stock" />
<Button data-testid="save-product">Guardar</Button>
```

