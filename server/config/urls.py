from django.contrib import admin
from django.urls import path
from django.contrib.auth import views as auth
from blog import views
urlpatterns=[path('essays/',views.section,{'kind':'essay','title':'观点随笔','intro':'认真思考，自由表达。'},name='essays'),path('diary/',views.section,{'kind':'diary','title':'每日日记','intro':'把平凡的一天，写成值得记住的一页。'},name='diary'),path('observations/',views.section,{'kind':'article','title':'所见所闻','intro':'收藏沿途的风景和生活里的小发现。'},name='observations'),path('admin/',admin.site.urls),path('',views.profile,name='home'),path('timeline/',views.home,name='timeline'),path('account/',views.account,name='account'),path('post/<int:pk>/',views.detail,name='detail'),path('media/<int:pk>/',views.media,name='media'),path('register/',views.register,name='register'),path('login/',auth.LoginView.as_view(template_name='login.html'),name='login'),path('logout/',auth.LogoutView.as_view(),name='logout')]
