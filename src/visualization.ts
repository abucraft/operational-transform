import { apply } from './text';

$('body').append(`<div>${apply("foo", [{ t: "insert", v: "abc" }])}</div>`)