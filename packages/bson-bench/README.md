# bson-bench 

This library provides functionality to install and run benchmarks against bson.

> [!IMPORTANT]
> This library is **NOT** an official MongoDB product and is meant for internal use only

## Usage

```ts
import { Suite } from 'bson-bench';

const int32SerializationSuite = new Suite('int32Serialization')
    .task({
        documentPath: 'path/to/test/file0',
        operation: 'serialize',
        warmup: 100,
        iterations: 100,
        options: {},
        library: 'bson@6.0.0'
    })
    .task({
        documentPath: 'path/to/test/file1',
        operation: 'serialize',
        warmup: 100,
        iterations: 100,
        options: {},
        library: 'bson@6.0.0'
    })
    .task({
        documentPath: 'path/to/test/file2',
        operation: 'serialize',
        warmup: 100,
        iterations: 100,
        options: {},
        library: 'bson@6.0.0'
    });

int32SerializationSuite.run()
    .then(() => int32SerializationSuite.writeResults())
    .then(() => console.log('complete'));
```
