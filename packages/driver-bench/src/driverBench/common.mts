
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const { DRIVER_PATH } = process.env
const { MongoClient, GridFSBucket } = await import(DRIVER_PATH ?? 'mongodb')

const DB_NAME = 'perftest';
const COLLECTION_NAME = 'corpus';

const SPEC_DIRECTORY = path.resolve(__dirname, 'spec');

export function loadSpecFile(filePath): Buffer;
export function loadSpecFile(filePath, encoding): Buffer;
export function loadSpecFile(filePath, encoding: 'utf8'): string;
export function loadSpecFile(filePath, encoding?: BufferEncoding): string | Buffer {
  const fp = [SPEC_DIRECTORY].concat(filePath);
  return fs.readFileSync(path.join.apply(path, fp), encoding);
}

export function loadSpecString(filePath) {
  return loadSpecFile(filePath, 'utf8');
}

export function makeClient() {
  this.client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
}

export function connectClient() {
  return this.client.connect();
}

export function disconnectClient() {
  this.client.close();
}

export function initDb() {
  this.db = this.client.db(DB_NAME);
}

export function dropDb() {
  return this.db.dropDatabase();
}

export function createCollection() {
  return this.db.createCollection(COLLECTION_NAME);
}

export function initCollection() {
  this.collection = this.db.collection(COLLECTION_NAME);
}

export function dropCollection() {
  return this.collection.drop().catch(e => {
    if (e.code !== 26 /* NamespaceNotFound */) {
      throw e;
    }
  });
}

export function initBucket() {
  this.bucket = new GridFSBucket(this.db);
}

export function dropBucket() {
  return this.bucket && this.bucket.drop();
}

export function makeLoadJSON(name) {
  return function () {
    this.doc = JSON.parse(loadSpecString(['single_and_multi_document', name]));
  };
}

export function makeLoadTweets(makeId) {
  return function () {
    const doc = this.doc;
    const tweets = [];
    for (let _id = 1; _id <= 10000; _id += 1) {
      tweets.push(Object.assign({}, doc, makeId ? { _id } : {}));
    }

    return this.collection.insertMany(tweets);
  };
}

export function makeLoadInsertDocs(numberOfOperations) {
  return function () {
    this.docs = [];
    for (let i = 0; i < numberOfOperations; i += 1) {
      this.docs.push(Object.assign({}, this.doc));
    }
  };
}

export async function writeSingleByteFileToBucket() {
  const stream = this.bucket.openUploadStream('setup-file.txt');
  const oneByteFile = Readable.from('a');
  return pipeline(oneByteFile, stream);
}
