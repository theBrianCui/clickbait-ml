const LEFT = "https://www.buzzfeed.com/us/feedpage/feed/search_buzzes?page=";
const RIGHT = ["&page_name=badge&tags.tag_name=lol&tags.tag_type=badge",
                "&page_name=badge&tags.tag_name=omg&tags.tag_type=badge",
                "&page_name=badge&tags.tag_name=wtf&tags.tag_type=badge"];
for (let i = 1; i <= 100; ++i) {
    console.log(LEFT + i + RIGHT[0]);
    console.log(LEFT + i + RIGHT[1]);
    console.log(LEFT + i + RIGHT[2]);
}