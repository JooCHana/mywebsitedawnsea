import secrets,time,mimetypes
from datetime import timedelta
from django.shortcuts import render,redirect,get_object_or_404
from django.http import FileResponse,HttpResponseForbidden
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.utils import timezone
from django.core.paginator import Paginator
from .models import *
def visible(request):
    q=Post.objects.all()
    if request.user.is_superuser: return q
    return q.filter(visibility__in=['public','members'] if request.user.is_authenticated else ['public'])
def context(): return {'site':SiteSettings.objects.first() or SiteSettings()}
def home(request):
    q=visible(request)
    for field,param in [('kind','kind'),('tags__name','tag'),('category__name','category'),('created__date','date')]:
        value=request.GET.get(param)
        if value:
            if param=='date':
                from datetime import date
                try: date.fromisoformat(value)
                except ValueError: continue
            q=q.filter(**{field:value})
    if request.GET.get('q'): q=q.filter(Q(title__icontains=request.GET['q'])|Q(body__icontains=request.GET['q']))
    return render(request,'home.html',{**context(),'page':Paginator(q.distinct(),10).get_page(request.GET.get('page')),'tags':Tag.objects.filter(posts__in=visible(request)).distinct()})
def challenge(request):
    a,b=secrets.randbelow(9)+1,secrets.randbelow(9)+1
    request.session['captcha']=str(a+b)
    return f'{a} + {b} = ?'
def correct(request):
    expected=request.session.pop('captcha',None)
    return expected is not None and request.POST.get('captcha')==expected

def detail(request,pk):
    post=get_object_or_404(visible(request),pk=pk); error=''
    if request.method=='POST':
        if not request.user.is_authenticated: return redirect('login')
        body=request.POST.get('body','').strip()
        if not correct(request): error='验证码错误，请重试。'
        elif not 2<=len(body)<=2000: error='评论长度应为 2–2000 字。'
        elif Comment.objects.filter(user=request.user,created__gte=timezone.now()-timedelta(seconds=60)).exists(): error='请稍后再发表评论。'
        else:
            Comment.objects.create(post=post,user=request.user,body=body)
            error='评论已提交，审核后展示。'
    return render(request,'detail.html',{**context(),'post':post,'comments':post.comments.filter(approved=True),'captcha':challenge(request),'error':error})
def register(request):
    form=UserCreationForm(request.POST or None); error=''
    if request.method=='POST':
        if not correct(request): error='验证码错误。'
        elif form.is_valid():
            form.save(); return redirect('login')
    return render(request,'register.html',{**context(),'form':form,'captcha':challenge(request),'error':error})
def media(request,pk):
    item=get_object_or_404(Attachment,pk=pk,post__in=visible(request))
    download=request.GET.get('download')=='1'
    if download and (not request.user.is_authenticated or not item.downloadable): return HttpResponseForbidden('不允许下载')
    response=FileResponse(item.file.open('rb'),as_attachment=download,content_type=mimetypes.guess_type(item.file.name)[0] or 'application/octet-stream')
    response['Cache-Control']='private, no-store'
    return response

def profile(request):
    return render(request,'profile.html',context())
def section(request,kind,title,intro):
    posts=visible(request).filter(kind=kind)
    query=request.GET.get('q','').strip()
    if query: posts=posts.filter(Q(title__icontains=query)|Q(body__icontains=query))
    return render(request,'section.html',{**context(),'title':title,'intro':intro,'page':Paginator(posts,10).get_page(request.GET.get('page'))})
@login_required
def account(request):
    return render(request,'account.html',context())
