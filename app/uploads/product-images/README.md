# Product Images

Put product photos in this folder to make receipt summaries use real images.

Supported formats:

- `.webp`
- `.jpg`
- `.jpeg`
- `.png`

Recommended file names:

- `product-{product_id}.webp`, for example `product-12.webp`
- `{product_id}.webp`, for example `12.webp`
- normalized product name, for example `молоко-2-5.webp`

The public URL is:

```text
/uploads/product-images/{filename}
```

If no matching file exists, the app falls back to the category image from
`../category-images/`.
