from django.contrib import admin
from .models import *
class AttachmentInline(admin.TabularInline):
    model=Attachment
    extra=1
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display=['title','kind','visibility','created']
    list_filter=['kind','visibility','category','tags']
    search_fields=['title','body']
    filter_horizontal=['tags']
    inlines=[AttachmentInline]
@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display=['user','post','approved','created']
    list_filter=['approved']
    list_editable=['approved']
admin.site.register([Category,Tag,SiteSettings])
admin.site.site_header='凌晨的海 · 管理'
