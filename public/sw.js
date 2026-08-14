// Legacy registration path kept for older OurHome installs.
// The actual offline + push worker lives in one place so the two registrations
// can never replace each other with different capabilities again.
importScripts('/ourhome-sw.js');
