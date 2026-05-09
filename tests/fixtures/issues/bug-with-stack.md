## Steps to Reproduce

1. Run `npm install`
2. Call `myFunc()`
3. See error

## Expected

No error.

## Actual

```
TypeError: Cannot read properties of undefined (reading 'foo')
    at myFunc (src/index.js:42:15)
    at Object.<anonymous> (src/main.js:10:5)
```

## Environment

- Node v18.16.0
- npm 9.5.1
