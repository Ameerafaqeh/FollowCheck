# FollowCheck v8 — Logo Contrast + Safety + Guide

Static site for GitHub Pages. Upload all files together to repository root. No backend.

## Changes
- Logo on a pale surface so the original dark-purple wordmark stays readable.
- Added Facebook contact link supplied by site owner.
- Added a clearly qualified warning about large batches of unfollows. 100 is a precautionary suggestion, not an official safe limit.
- Added `#download-guide` with four placeholder cards. Replace placeholders with actual screenshots once provided; do not publish placeholder cards as completed instructions.

## When screenshots arrive
Replace each `<div class="guide-image-placeholder">...` in index.html with an `<img src="images/step-01.png" alt="..." class="guide-shot">` (and step-02, etc.). Add to CSS: `.guide-shot{width:100%;height:auto;display:block}`. Steps and wording should be adjusted to match the actual Instagram screens.

## Important
Files are analyzed locally. Old exports do not reflect changes after export. No automatic unfollowing. Test across devices before launch.


## تحديث دليل الاستخدام
تمت إضافة دليل مصور من 24 خطوة في guide-images مع التنقل والتكبير. تم إزالة الخلفية البيضاء المفروضة خلف الشعار الشفاف.


Mobile Pro update: swipe left/right on guide image or zoom overlay; accessible keyboard navigation; responsive refinements. Deploy all files to GitHub Pages root. No external dependencies.
