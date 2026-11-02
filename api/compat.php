<?php

/**
 * Polyfills for the functions this API uses that are newer than the server's
 * PHP 7.2. Keeps the campaign site running on the legacy mashpia.com PHP while
 * the code is written in the newer idiom. Each is a no-op on PHP that already
 * has the function, so this file is safe to load everywhere.
 *
 * - str_starts_with / str_ends_with / str_contains: PHP 8.0
 * - array_key_first / array_key_last: PHP 7.3
 */

if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool
    {
        return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

if (!function_exists('str_ends_with')) {
    function str_ends_with(string $haystack, string $needle): bool
    {
        return $needle === '' || substr($haystack, -strlen($needle)) === $needle;
    }
}

if (!function_exists('str_contains')) {
    function str_contains(string $haystack, string $needle): bool
    {
        return $needle === '' || strpos($haystack, $needle) !== false;
    }
}

if (!function_exists('array_key_first')) {
    function array_key_first(array $arr)
    {
        foreach ($arr as $key => $_) {
            return $key;
        }
        return null;
    }
}

if (!function_exists('array_key_last')) {
    function array_key_last(array $arr)
    {
        if (empty($arr)) {
            return null;
        }
        return key(array_slice($arr, -1, 1, true));
    }
}
